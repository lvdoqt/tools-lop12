"""Editable OMML and MathType equations; no desktop Office dependency."""

from copy import deepcopy
from dataclasses import dataclass, fields, is_dataclass
from hashlib import sha256
import re

from lxml import etree
from latex2mathml.converter import convert
from docx_equation.mathtype import mtef
from docx_equation.shared.mathml import parse_mathml

from .latex_quiz import expand_system_macros
from .word_ole import build_equation_ole

MATH_NS = 'http://www.w3.org/1998/Math/MathML'
OMML_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/math'


def math_node(name, *children, value=None):
    node = etree.Element(f'{{{OMML_NS}}}{name}', nsmap={'m': OMML_NS})
    if value is not None:
        node.set(f'{{{OMML_NS}}}val', str(value))
    node.extend(children)
    return node


def omml_nodes(node):
    """Map supported presentation MathML to editable Office Math structures."""
    tag = etree.QName(node).localname
    children = list(node)
    def slot(name, source):
        return math_node(name, *omml_nodes(source))
    if tag in ('math', 'mrow', 'mstyle', 'mtd', 'mpadded'):
        return [part for child in children for part in omml_nodes(child)]
    if tag in ('mi', 'mn', 'mo', 'mtext', 'mspace'):
        value = ''.join(node.itertext()) if tag != 'mspace' else ' '
        text = math_node('t'); text.text = value
        text.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
        props = math_node('rPr', math_node('sty', value='i' if tag == 'mi' and len(value) == 1 else 'p'))
        return [math_node('r', props, text)]
    if tag == 'mfrac':
        return [math_node('f', slot('num', children[0]), slot('den', children[1]))]
    if tag in ('msqrt', 'mroot'):
        degree = slot('deg', children[1]) if tag == 'mroot' else math_node('deg')
        body = slot('e', children[0]) if tag == 'mroot' else math_node('e', *[part for child in children for part in omml_nodes(child)])
        return [math_node('rad', math_node('radPr', math_node('degHide', value='0' if tag == 'mroot' else '1')), degree, body)]
    if tag in ('msub', 'msup', 'msubsup'):
        parts = [slot('e', children[0])]
        if tag in ('msub', 'msubsup'): parts.append(slot('sub', children[1]))
        if tag in ('msup', 'msubsup'): parts.append(slot('sup', children[-1]))
        return [math_node({'msub': 'sSub', 'msup': 'sSup', 'msubsup': 'sSubSup'}[tag], *parts)]
    if tag == 'mfenced':
        props = math_node('dPr', math_node('begChr', value=node.get('open', '(')), math_node('endChr', value=node.get('close', ')')), math_node('grow', value='1'))
        body = math_node('e', *[part for child in children for part in omml_nodes(child)])
        return [math_node('d', props, body)]
    if tag == 'mtable':
        rows = [math_node('mr', *[slot('e', cell) for cell in row]) for row in children]
        return [math_node('m', *rows)]
    if tag in ('mover', 'munder', 'munderover'):
        accent = ''.join(children[-1].itertext())
        if tag == 'mover' and (node.get('accent') == 'true' or accent in ('¯', '‾', '→', '⃗', '^', 'ˆ', '̂', '~', '˜')):
            if accent in ('¯', '‾', '̅'):
                return [math_node('bar', math_node('barPr', math_node('pos', value='top')), slot('e', children[0]))]
            return [math_node('acc', math_node('accPr', math_node('chr', value=accent)), slot('e', children[0]))]
        base = slot('e', children[0])
        if tag == 'munderover':
            low = math_node('limLow', base, slot('lim', children[1]))
            return [math_node('limUpp', math_node('e', low), slot('lim', children[2]))]
        return [math_node('limLow' if tag == 'munder' else 'limUpp', base, slot('lim', children[1]))]
    raise ValueError(f'Cấu trúc công thức {tag} chưa hỗ trợ.')


@dataclass(frozen=True)
class Subscript:
    base: object
    subscript: object

    def encode(self):
        # docx-equation 0.3.0 omits the terminating END for this template.
        return self.base.encode() + b'\x03\x00\x1b\x00\x00\x0b' + mtef._line(self.subscript) + b'\x01\x01\x00\x0a'


@dataclass(frozen=True)
class MathText:
    value: str

    def encode(self):
        parts = []
        for char in self.value:
            if ord(char) > 127 and ord(char) <= 0xFFFF and char not in mtef._OPERATOR_CODE:
                # USER2 is explicitly Cambria Math; include the Unicode font
                # position so MathType does not look up symbols in ANSI fonts.
                code = ord(char).to_bytes(2, 'little')
                parts.append(b'\x02\x10\x8a' + code + code)
            else:
                parts.append(mtef._encode_char(char))
        return b''.join(parts)


@dataclass(frozen=True)
class Superscript:
    base: object
    superscript: object

    def encode(self):
        return self.base.encode() + b'\x03\x00\x1c\x00\x00\x0b\x01\x01' + mtef._line(self.superscript) + b'\x00\x0a'


@dataclass(frozen=True)
class Sqrt:
    radicand: object
    index: object = None

    def encode(self):
        degree = mtef._line(self.index) if self.index is not None else b'\x01\x01'
        return mtef._template(0x0A, int(self.index is not None), 0) + mtef._line(self.radicand) + degree + b'\x00'


@dataclass(frozen=True)
class BigOperator(mtef.BigOperator):
    def encode(self):
        selector, variation = mtef._BIG_OPERATOR_TEMPLATE.get(self.operator, (0x16, 0x40))
        variation |= int(self.lower is not None) | (2 if self.upper is not None else 0)
        upper = mtef._line(self.upper) if self.upper is not None else b'\x01\x01'
        lower = mtef._line(self.lower) if self.lower is not None else b'\x01\x01'
        return mtef._template(selector, variation, 0) + mtef._line(self.body) + upper + lower + MathText(self.operator).encode() + b'\x00'


@dataclass(frozen=True)
class Fence:
    body: object
    left: str
    right: str

    def encode(self):
        selectors = {'(': 1, ')': 1, '{': 2, '}': 2, '[': 3, ']': 3, '|': 4, '‖': 5, '⌊': 6, '⌋': 6, '⌈': 7, '⌉': 7}
        selector = selectors.get(self.left or self.right)
        if selector is None:
            raise ValueError('Kiểu ngoặc công thức chưa hỗ trợ MathType.')
        variation = (1 if self.left else 0) | (2 if self.right else 0)
        return (mtef._template(selector, variation, 0) + mtef._line(self.body)
                + mtef.Text(self.left).encode() + mtef.Text(self.right).encode() + b'\x00')


def fix_mtef(expr):
    if isinstance(expr, (mtef.Text, mtef.Symbol)):
        return MathText(expr.value)
    if isinstance(expr, mtef.Subscript):
        return Subscript(fix_mtef(expr.base), fix_mtef(expr.subscript))
    if isinstance(expr, mtef.Superscript):
        return Superscript(fix_mtef(expr.base), fix_mtef(expr.superscript))
    if isinstance(expr, mtef.Sqrt):
        return Sqrt(fix_mtef(expr.radicand), fix_mtef(expr.index))
    if isinstance(expr, mtef.BigOperator):
        return BigOperator(expr.operator, fix_mtef(expr.body), fix_mtef(expr.lower), fix_mtef(expr.upper))
    if isinstance(expr, mtef.Fence):
        return Fence(fix_mtef(expr.body), expr.left, expr.right)
    if isinstance(expr, tuple):
        return tuple(fix_mtef(item) for item in expr)
    if is_dataclass(expr):
        return type(expr)(**{field.name: fix_mtef(getattr(expr, field.name)) for field in fields(expr)})
    return expr


def compile_math(latex):
    # Some Quiz Bank exports retain alignment markers but lose the row-ending
    # backslashes. A following line starting with & still identifies that row.
    latex = re.sub(r'(?<!\\)\n[ \t]*(?=&)', lambda _: r'\\' + '\n', latex)
    normalized = expand_system_macros(latex)
    normalized = re.sub(r'\\allowdisplaybreaks(?:\[[^\]]*\])?', '', normalized)
    normalized = re.sub(r'\\(?:begin|end)\{equation\*?\}', '', normalized)
    normalized = re.sub(r'\\(begin|end)\{(?:aligned|gathered|align\*?|eqnarray\*?|gather\*?|multline\*?)\}', r'\\\1{matrix}', normalized)
    mathml = convert(normalized)
    root = etree.fromstring(mathml.encode())
    # latex2mathml exposes unknown macros as text. Never export them as equations.
    if any('\\' in (node.text or '') for node in root.iter()):
        raise ValueError('Có lệnh LaTeX chưa hỗ trợ.')
    # Convert stretchy \left...\right rows into semantic fences for both writers.
    for row in list(root.iter(f'{{{MATH_NS}}}mrow')):
        children = list(row)
        if len(children) >= 2 and children[0].get('fence') == 'true' and children[-1].get('fence') == 'true':
            left, right = children[0].text or '', children[-1].text or ''
            row.remove(children[0]); row.remove(children[-1])
            row.tag = f'{{{MATH_NS}}}mfenced'
            row.set('open', left); row.set('close', right); row.set('separators', '')
    mathml = etree.tostring(root, encoding='unicode')
    omml = math_node('oMath', *omml_nodes(root))
    preamble = mtef._preamble('DSMT4').replace(mtef._font_def(5, 'Arial'), mtef._font_def(5, 'Times New Roman'))
    preamble = preamble.replace(mtef._font_def(5, 'Times New Roman') + mtef._font_def(4, 'MT Extra Tiger'),
                                mtef._font_def(5, 'Cambria Math') + mtef._font_def(4, 'MT Extra'))
    ole = build_equation_ole(preamble + b'\x0a' + mtef._line(fix_mtef(parse_mathml(mathml))) + b'\x00')
    return {'id': sha256(latex.encode()).hexdigest()[:24], 'latex': latex, 'mathml': mathml, 'omml': omml, 'ole': ole}


def equation_element(formula):
    return deepcopy(formula['omml'])
