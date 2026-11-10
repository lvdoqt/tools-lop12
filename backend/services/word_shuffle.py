"""Shuffle intact OOXML question blocks, retaining MathType, equations and images."""
from copy import deepcopy
from dataclasses import dataclass, field, replace
from io import BytesIO
import json
import math
import random
import re
import zipfile

from lxml import etree
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
NS = {'w': W, 'm': 'http://schemas.openxmlformats.org/officeDocument/2006/math'}
SECTION = re.compile(r'^\s*PHẦN\s+(III|II|I)\b', re.I)
QUESTION = re.compile(r'^\s*(?:Câu|Question)\s+(\d+)\s*[.:]', re.I)
SOLUTION = re.compile(r'^\s*Lời\s+giải\s*[:.]?\s*$', re.I)
SHORT = re.compile(r'^\s*(?:Đáp\s*án|Đáp\s*số|Trả\s*lời)\s*:\s*([+\-−]?\d+(?:[.,]\d+)?)\s*[.]?\s*$', re.I)
TF_SOLUTION = re.compile(r'(?<!\w)([abcd])\s*\)\s*[:.\-]?\s*(ĐÚNG|SAI)\b', re.I)
MCQ_LABEL = re.compile(r'(?<!\S)([ABCD])\s*[.)]')
CLOZE_HINT_RE = re.compile(r'(?:blanks?\s+from\s+\d+\s+to\s+\d+|\(\d+\)_{3,}|chỗ\s+trống)', re.I)
LISTEN_HINT_RE = re.compile(r'(?:listen|recording|audio|nghe)', re.I)
GROUP_INDICATOR_RE = re.compile(r'^(?:Read\s+the\s+following|Mark\s+the\s+letter|Section\s+\d+|LISTENING|PART\s+\d+|PHẦN\s+[IVX]+)', re.I)
GROUP_TAG_RE = re.compile(r'<\s*(#)?\s*g\s*([0-3])\s*>', re.I)
MAX_UPLOAD = 4 * 1024 * 1024
MAX_OUTPUT = 4 * 1024 * 1024


def tag(name):
    return f'{{{W}}}{name}'


def text_map(element):
    """Visible text and owning runs; labels may span several Word runs."""
    text, owners = [], []
    for node in element.iter():
        if node.tag in (tag('t'), f'{{{NS["m"]}}}t'):
            value = node.text or ''
        elif node.tag in (tag('tab'), tag('br'), tag('cr')):
            if node.tag == tag('tab') and node.getparent().tag == tag('tabs'):
                continue
            value = '\t' if node.tag == tag('tab') else '\n'
        else:
            continue
        parent = node.getparent()
        while parent is not None and parent.tag != tag('r'):
            parent = parent.getparent()
        text.append(value)
        owners.extend([parent] * len(value))
    return ''.join(text), owners


def paragraphs(blocks):
    for block in blocks:
        if block.tag == tag('p'):
            yield block
        else:
            yield from block.iter(tag('p'))


def plain(blocks):
    return '\n'.join(text_map(p)[0] for p in paragraphs(blocks))


def strip_group_tags_from_block(block):
    """Remove <g0>, <#g2>, etc. from runs so tags do not appear in the exported DOCX."""
    for p in paragraphs([block]):
        nodes = list(p.iter(tag('t')))
        full_text = ''.join(n.text or '' for n in nodes)
        matches = list(GROUP_TAG_RE.finditer(full_text))
        if not matches:
            continue
        for m in reversed(matches):
            start, end = m.span()
            offset = 0
            for n in nodes:
                t = n.text or ''
                l, r = max(0, start - offset), min(len(t), end - offset)
                if l < r:
                    n.text = t[:l] + t[r:]
                offset += len(t)


@dataclass
class Question:
    number: int
    blocks: list = field(default_factory=list)
    solution: list = field(default_factory=list)
    answer: str = ''
    options: list = field(default_factory=list)
    errors: list = field(default_factory=list)
    option_order: tuple = (0, 1, 2, 3)


@dataclass
class ExamGroup:
    index: int
    name: str
    header: list = field(default_factory=list)
    questions: list = field(default_factory=list)
    fixed_position: bool = False
    mode: int = 3


class Exam:
    def __init__(self, content, subject='toan'):
        self.subject = subject
        try:
            with zipfile.ZipFile(BytesIO(content)) as archive:
                entries = archive.infolist()
                if len(entries) > 6000 or sum(i.file_size for i in entries) > 64 * 1024 * 1024:
                    raise ValueError('Tài liệu Word quá lớn sau giải nén (tối đa 64 MB).')
                if len({i.filename for i in entries}) != len(entries):
                    raise ValueError('File Word có các thành phần trùng tên.')
                self.files = {i.filename: archive.read(i) for i in entries}
            parser = etree.XMLParser(resolve_entities=False, no_network=True)
            self.root = etree.fromstring(self.files['word/document.xml'], parser)
            if self.root.getroottree().docinfo.doctype:
                raise ValueError('XML của tài liệu Word không hợp lệ.')
            self.styles = {}
            if 'word/styles.xml' in self.files:
                styles = etree.fromstring(self.files['word/styles.xml'], parser)
                self.styles = {s.get(tag('styleId')): s for s in styles.findall('w:style', NS)}
        except (zipfile.BadZipFile, KeyError, etree.XMLSyntaxError, RuntimeError) as exc:
            raise ValueError('Không đọc được DOCX. Hãy mở bằng Word và lưu lại dạng .docx.') from exc
        self.body = self.root.find('w:body', NS)
        if self.body is None:
            raise ValueError('File Word không có nội dung.')
        if self.body.xpath('.//w:ins | .//w:del | .//w:sdt | .//w:altChunk', namespaces=NS):
            raise ValueError('Hãy chấp nhận các thay đổi và chuyển content control thành văn bản trước khi trộn.')

        self.prefix = []
        self.headings = {}
        self.sections = {}
        self.groups = []
        self.group_configs = {}
        self.freeze_map = {}
        self.errors, self.warnings = [], []
        self.seen = []
        self.sectpr = None

        raw_blocks = []
        for block in self.body:
            if block.tag == tag('sectPr'):
                self.sectpr = block
                continue
            if block.tag not in (tag('p'), tag('tbl'), tag('bookmarkStart'), tag('bookmarkEnd')):
                raise ValueError('Tài liệu có khối nội dung chưa hỗ trợ. Hãy lưu câu hỏi bằng đoạn văn Word.')
            raw_blocks.append(block)

        has_g_tags = any(GROUP_TAG_RE.search(text_map(b)[0]) for b in raw_blocks if b.tag == tag('p'))
        has_phan = any(SECTION.match(text_map(b)[0]) for b in raw_blocks if b.tag == tag('p'))

        if self.subject == 'toan' and not has_g_tags and has_phan:
            # Traditional section parsing (PHẦN I, II, III) for Math
            self.headings = {s: [] for s in ('I', 'II', 'III')}
            self.sections = {s: [] for s in self.headings}
            section, current, solving = None, None, False
            seen = []
            for block in raw_blocks:
                value = text_map(block)[0] if block.tag == tag('p') else ''
                heading, question = SECTION.match(value), QUESTION.match(value)
                if heading:
                    section = heading[1].upper()
                    if section in seen:
                        raise ValueError(f'Phần {section} xuất hiện nhiều lần. Mỗi file chỉ chứa một đề gốc.')
                    seen.append(section)
                    current, solving = None, False
                    self.headings[section].append(block)
                elif question:
                    if section is None:
                        raise ValueError('Có câu hỏi trước tiêu đề PHẦN.')
                    current = Question(int(question[1]), [block])
                    self.sections[section].append(current)
                    solving = False
                elif current is not None:
                    if SOLUTION.match(value):
                        solving = True
                    (current.solution if solving else current.blocks).append(block)
                elif section:
                    self.headings[section].append(block)
                else:
                    self.prefix.append(block)
                if block.tag == tag('tbl') and any(QUESTION.match(text_map(p)[0]) for p in paragraphs([block])):
                    raise ValueError('Câu hỏi nằm trong bảng chưa được hỗ trợ. Hãy đưa nhãn Câu n ra ngoài bảng; bảng trong nội dung vẫn được giữ.')
            if not seen:
                raise ValueError('Không tìm thấy tiêu đề PHẦN nào. Mỗi phần bắt đầu bằng "PHẦN I", "PHẦN II" hoặc "PHẦN III".')
            order_map = {'I': 0, 'II': 1, 'III': 2}
            if [order_map[s] for s in seen] != sorted(order_map[s] for s in seen):
                raise ValueError('Các tiêu đề PHẦN phải xuất hiện theo đúng thứ tự I, II, III.')
            self.seen = seen
            for idx, s in enumerate(self.seen, 1):
                eg = ExamGroup(idx, s, self.headings[s], self.sections[s], fixed_position=True, mode=3 if s == 'I' else 2)
                self.groups.append(eg)
                self.group_configs[s] = {'fixed_position': True, 'mode': eg.mode}
                self.freeze_map[s] = (eg.mode in (0, 2))
        else:
            # Group-based parsing for English, or files with <g> tags
            parsed_groups = []
            curr_hdr = []
            curr_qs = []
            curr_q = None
            curr_fixed = False
            curr_mode = 3
            curr_tag_found = False
            exam_started = False
            solving = False

            for block in raw_blocks:
                value = text_map(block)[0] if block.tag == tag('p') else ''
                tag_match = GROUP_TAG_RE.search(value) if block.tag == tag('p') else None
                q_match = QUESTION.match(value) if block.tag == tag('p') else None
                is_hdr_indicator = bool(GROUP_INDICATOR_RE.match(value)) if block.tag == tag('p') else False

                if tag_match:
                    new_fixed = bool(tag_match.group(1))
                    new_mode = int(tag_match.group(2))
                    if curr_qs:
                        parsed_groups.append({
                            'header': curr_hdr,
                            'questions': curr_qs,
                            'fixed_position': curr_fixed,
                            'mode': curr_mode,
                            'has_tag': curr_tag_found,
                        })
                        curr_hdr = [block]
                        curr_qs = []
                        curr_q = None
                        curr_fixed = new_fixed
                        curr_mode = new_mode
                        curr_tag_found = True
                        solving = False
                    else:
                        curr_fixed = new_fixed
                        curr_mode = new_mode
                        curr_tag_found = True
                        curr_hdr.append(block)
                elif q_match:
                    exam_started = True
                    solving = False
                    curr_q = Question(int(q_match[1]), [block])
                    curr_qs.append(curr_q)
                elif curr_q is not None:
                    if is_hdr_indicator and not curr_tag_found:
                        if curr_qs:
                            parsed_groups.append({
                                'header': curr_hdr,
                                'questions': curr_qs,
                                'fixed_position': curr_fixed,
                                'mode': curr_mode,
                                'has_tag': False,
                            })
                            curr_hdr = [block]
                            curr_qs = []
                            curr_q = None
                            curr_fixed = False
                            curr_mode = 3
                            solving = False
                    else:
                        if SOLUTION.match(value):
                            solving = True
                        (curr_q.solution if solving else curr_q.blocks).append(block)
                elif exam_started:
                    curr_hdr.append(block)
                else:
                    if is_hdr_indicator or curr_hdr or tag_match:
                        curr_hdr.append(block)
                    else:
                        self.prefix.append(block)

            if curr_qs:
                parsed_groups.append({
                    'header': curr_hdr,
                    'questions': curr_qs,
                    'fixed_position': curr_fixed,
                    'mode': curr_mode,
                    'has_tag': curr_tag_found,
                })

            if not parsed_groups:
                raise ValueError('Không tìm thấy câu hỏi nào trong đề (Question 1, Question 2... hoặc Câu 1, Câu 2...).')

            for idx, g in enumerate(parsed_groups, 1):
                if not g['has_tag']:
                    hdr_texts = [text_map(b)[0].strip() for b in g['header'] if text_map(b)[0].strip()]
                    combined_hdr = ' '.join(hdr_texts)
                    is_cloze = bool(CLOZE_HINT_RE.search(combined_hdr))
                    is_listen = bool(LISTEN_HINT_RE.search(combined_hdr))
                    if is_cloze or is_listen:
                        g['fixed_position'] = True
                        g['mode'] = 2
                    else:
                        g['fixed_position'] = False
                        g['mode'] = 3

                clean_hdr = []
                for b in g['header']:
                    strip_group_tags_from_block(b)
                    if b.tag == tag('p') and not text_map(b)[0].strip() and not b.xpath('.//w:drawing | .//w:object | .//m:oMath', namespaces=NS):
                        continue
                    clean_hdr.append(b)
                g['header'] = clean_hdr

                q_min = min(q.number for q in g['questions'])
                q_max = max(q.number for q in g['questions'])
                tag_label = f'<{"#" if g["fixed_position"] else ""}g{g["mode"]}>'
                name = f'Nhóm {idx} (Câu {q_min}–{q_max})'

                eg = ExamGroup(
                    index=idx,
                    name=name,
                    header=g['header'],
                    questions=g['questions'],
                    fixed_position=g['fixed_position'],
                    mode=g['mode']
                )
                self.groups.append(eg)
                self.seen.append(name)
                self.headings[name] = g['header']
                self.sections[name] = g['questions']
                self.freeze_map[name] = (g['mode'] in (0, 2))
                self.group_configs[name] = {
                    'fixed_position': g['fixed_position'],
                    'mode': g['mode'],
                    'tag': tag_label
                }

        for section, questions in self.sections.items():
            if section not in self.seen:
                continue
            if not questions:
                self.errors.append(f'Phần {section} chưa có câu hỏi.')
            numbers = [q.number for q in questions]
            if len(set(numbers)) != len(numbers):
                self.errors.append(f'Phần/Nhóm {section} có số câu trùng nhau.')
            for question in questions:
                self.read_answer(section, question)
                self.errors.extend(f'Phần {section}, câu {question.number}: {e}' for e in question.errors)
                has_equation = any(b.xpath('.//w:object | .//m:oMath | .//w:drawing | .//w:pict', namespaces=NS) for b in question.solution)
                if not has_equation and (not plain(question.solution).strip() or SOLUTION.fullmatch(plain(question.solution).strip())):
                    self.warnings.append(f'Phần {section}, câu {question.number}: chưa có nội dung lời giải.')
        if sum(map(len, self.sections.values())) > 200:
            raise ValueError('Mỗi đề tối đa 200 câu.')

    def underlined(self, run):
        if run is None:
            return False
        direct = run.find('w:rPr/w:u', NS)
        if direct is not None:
            return direct.get(tag('val'), 'single') not in ('none', '0', 'false')
        ids = []
        style = run.find('w:rPr/w:rStyle', NS)
        if style is not None:
            ids.append(style.get(tag('val')))
        paragraph = run.getparent()
        while paragraph is not None and paragraph.tag != tag('p'):
            paragraph = paragraph.getparent()
        if paragraph is not None:
            style = paragraph.find('w:pPr/w:pStyle', NS)
            if style is not None:
                ids.append(style.get(tag('val')))
        for style_id in ids:
            visited = set()
            while style_id in self.styles and style_id not in visited:
                visited.add(style_id)
                style = self.styles[style_id]
                underline = style.find('w:rPr/w:u', NS)
                if underline is not None:
                    return underline.get(tag('val'), 'single') not in ('none', '0', 'false')
                base = style.find('w:basedOn', NS)
                style_id = base.get(tag('val')) if base is not None else None
        return False

    def read_answer(self, section, question):
        is_mcq = self._is_mcq_part(section)
        if not is_mcq and section == 'III':
            matches = [SHORT.fullmatch(text_map(p)[0]) for p in paragraphs(question.solution)]
            answers = [m[1].replace('−', '-').replace('.', ',').lstrip('+') for m in matches if m]
            if len(answers) != 1:
                question.errors.append('Cần đúng một dòng “Đáp án: số”, “Đáp số: số” hoặc “Trả lời: số” dưới Lời giải.')
            else:
                question.answer = answers[0]
            return

        pattern = re.compile(r'(?<!\S)([ABCD])\s*[.)]' if is_mcq else r'(?<!\S)([abcd])\s*\)')
        for paragraph in paragraphs(question.blocks):
            value, owners = text_map(paragraph)
            matches = list(pattern.finditer(value))
            for i, match in enumerate(matches):
                question.options.append({
                    'label': match[1], 'correct': self.underlined(owners[match.start(1)]),
                    'text': value[match.end():matches[i + 1].start() if i + 1 < len(matches) else len(value)].strip(),
                })
        labels = [o['label'] for o in question.options]

        if self.subject == 'tieng_anh':
            if labels not in (list('ABCD'), list('AB'), list('ABC')):
                self.warnings.append(f'Câu {question.number}: Nhãn lựa chọn ({", ".join(labels) if labels else "không có"}) khác chuẩn A-D.')
            correct = [o['label'] for o in question.options if o['correct']]
            if len(correct) == 1:
                question.answer = correct[0]
            elif len(correct) > 1:
                question.errors.append('Có nhiều hơn một đáp án được gạch chân.')
            else:
                question.answer = ''
                self.warnings.append(f'Câu {question.number}: chưa gạch chân đáp án đúng.')
        elif section == 'I':
            if labels != list('ABCD'):
                question.errors.append('Không tách được đủ bốn nhãn A, B, C, D theo thứ tự.')
            else:
                correct = [o['label'] for o in question.options if o['correct']]
                if len(correct) != 1:
                    question.errors.append('Cần gạch chân đúng một nhãn A/B/C/D của phương án đúng.')
                else:
                    question.answer = correct[0]
        else:
            # Part II True/False for Math
            expected = list('abcd')
            if labels != expected:
                question.errors.append('Không tách được đủ bốn nhãn ' + ', '.join(expected) + ' theo thứ tự.')
            else:
                explicit = {}
                for match in TF_SOLUTION.finditer(plain(question.solution)):
                    label, correct = match[1].lower(), match[2].upper() == 'ĐÚNG'
                    if label in explicit and explicit[label] != correct:
                        question.errors.append(f'Lời giải ghi cả ĐÚNG và SAI cho ý {label}).')
                    explicit[label] = correct
                has_underlines = any(o['correct'] for o in question.options)
                if explicit and not has_underlines and len(explicit) != 4:
                    missing = ', '.join(label + ')' for label in 'abcd' if label not in explicit)
                    question.errors.append(f'Lời giải chưa ghi ĐÚNG/SAI cho ý {missing}; đề không có nhãn gạch chân để đối chiếu.')
                for option in question.options:
                    label = option['label']
                    if label in explicit:
                        if option['correct'] and not explicit[label]:
                            question.errors.append(f'Ý {label}) được gạch chân nhưng Lời giải ghi SAI.')
                        option['correct'] = explicit[label]
                if question.errors:
                    return
                question.answer = ''.join('Đ' if o['correct'] else 'S' for o in question.options)

    def summary(self):
        return {
            'total': sum(len(q) for p, q in self.sections.items() if p in self.seen),
            'errors': self.errors,
            'warnings': self.warnings,
            'sections': [{
                'part': g.name,
                'count': len(g.questions),
                'fixed_position': g.fixed_position,
                'mode': g.mode,
                'tag': f'<{"#" if g.fixed_position else ""}g{g.mode}>',
                'freeze': (g.mode in (0, 2)),
                'questions': [
                    {'number': q.number, 'text': plain(q.blocks), 'answer': q.answer,
                     'options': q.options, 'solution': plain(q.solution), 'errors': q.errors}
                    for q in g.questions
                ]
            } for g in self.groups if g.name in self.seen]
        }

    def _is_mcq_part(self, part):
        """Return True if this part uses MCQ (A/B/C/D) options."""
        return self.subject == 'tieng_anh' or part == 'I'


def renumber(block, number):
    nodes = list(block.iter(tag('t')))
    value = ''.join(n.text or '' for n in nodes)
    match = QUESTION.match(value)
    if not match:
        raise ValueError(f'Không thể đánh lại số câu hỏi: {repr(value)}')
    start, end = match.span(1)
    offset = 0
    for node in nodes:
        old = node.text or ''
        left, right = max(0, start - offset), min(len(old), end - offset)
        if left < right:
            node.text = old[:left] + (str(number) if offset <= start < offset + len(old) else '') + old[right:]
        offset += len(old)


def rich_slice(p, start, end):
    """Slice a paragraph by visible text offsets without converting its math or OLE."""
    total = len(text_map(p)[0])
    position = 0

    def visit(node):
        nonlocal position
        if node.tag in (tag('pPr'), tag('rPr')):
            return deepcopy(node)
        length = len(text_map(node)[0])
        if not length:
            return deepcopy(node) if start <= position < end or position == end == total else None
        if node.tag in (tag('t'), f'{{{NS["m"]}}}t', tag('tab'), tag('br'), tag('cr')):
            left, right = max(0, start - position), min(length, end - position)
            position += length
            if left >= right:
                return None
            result = deepcopy(node)
            if node.tag in (tag('t'), f'{{{NS["m"]}}}t'):
                result.text = (node.text or '')[left:right]
                result.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
            return result
        result = deepcopy(node)
        for child in list(result):
            result.remove(child)
        for child in node:
            copied = visit(child)
            if copied is not None:
                result.append(copied)
        return result if any(c.tag not in (tag('pPr'), tag('rPr')) for c in result) else None

    result = visit(p)
    if result is not None:
        for attribute in list(result.attrib):
            if attribute.endswith('}paraId') or attribute.endswith('}textId'):
                del result.attrib[attribute]
    return result


def trim_option(p):
    # Separators belong to layout slots, not to the answer being moved.
    for node in reversed(list(p.iter())):
        if node.tag in (tag('bookmarkStart'), tag('bookmarkEnd'), tag('r'), tag('rPr')):
            continue
        if node.tag == tag('t'):
            node.text = (node.text or '').rstrip()
            if node.text:
                break
        elif node.tag == tag('tab'):
            node.getparent().remove(node)
        elif node.tag not in (tag('p'),) and not node.tag.startswith(f'{{{W}}}'):
            break
        elif node.tag in (tag('object'), tag('drawing'), tag('pict')):
            break


def mark_tf_answers(blocks, answer):
    """Mark resolved answers even when the source only gives them in its solution."""
    for p in paragraphs(blocks):
        value, _ = text_map(p)
        matches = list(re.finditer(r'(?<!\S)([abcd])\s*\)', value))
        if not matches:
            continue
        pieces, cursor = [], 0
        for match in matches:
            start, end = match.span(1)
            if cursor < start:
                pieces.append(rich_slice(p, cursor, start))
            label = rich_slice(p, start, end)
            for run in label.iter(tag('r')):
                if not any(n.text for n in run.iter(tag('t'))):
                    continue
                props = run.find('w:rPr', NS)
                if props is None:
                    props = etree.Element(tag('rPr'))
                    run.insert(0, props)
                underline = props.find('w:u', NS)
                if underline is None:
                    underline = etree.SubElement(props, tag('u'))
                underline.set(tag('val'), 'single' if answer['abcd'.index(match[1])] == 'Đ' else 'none')
            pieces.append(label)
            cursor = end
        if cursor < len(value):
            pieces.append(rich_slice(p, cursor, len(value)))
        for child in list(p):
            if child.tag != tag('pPr'):
                p.remove(child)
        for piece in pieces:
            if piece is not None:
                p.extend(child for child in piece if child.tag != tag('pPr'))
    return blocks


def shuffled_blocks(question):
    """Keep the source's 4/2/1-option rows; move multi-paragraph answers together."""
    stem, choices, groups = [], [], []
    simple = True

    def blocks_with_options(blocks):
        for block in blocks:
            if block.tag == tag('tbl') and any(MCQ_LABEL.search(text_map(p)[0]) for p in paragraphs([block])):
                for cell in block.findall('w:tr/w:tc', NS):
                    yield from blocks_with_options([b for b in cell if b.tag != tag('tcPr')])
            else:
                yield block

    for block in blocks_with_options(question.blocks):
        value = text_map(block)[0] if block.tag == tag('p') else ''
        matches = list(MCQ_LABEL.finditer(value))
        if not matches:
            if choices:
                choices[-1].append(deepcopy(block))
                simple = False
            else:
                stem.append(deepcopy(block))
            continue
        prefix = rich_slice(block, 0, matches[0].start())
        if prefix is not None and (text_map(prefix)[0].strip() or prefix.xpath('.//w:object | .//w:drawing | .//m:oMath', namespaces=NS)):
            if choices:
                choices[-1].append(prefix)
                simple = False
            else:
                stem.append(prefix)
        groups.append((block, len(matches)))
        for i, match in enumerate(matches):
            end = matches[i + 1].start() if i + 1 < len(matches) else len(value)
            fragment = rich_slice(block, match.start(), end)
            trim_option(fragment)
            choices.append([fragment])
    if len(choices) != 4:
        return deepcopy(question.blocks)
    reordered = [choices[index] for index in question.option_order]
    for index, blocks in enumerate(reordered):
        node = next(n for n in blocks[0].iter(tag('t')) if n.text)
        node.text = 'ABCD'[index] + node.text[1:]
        run = node.getparent()
        while run is not None and run.tag != tag('r'):
            run = run.getparent()
        if run is not None:
            props = run.find('w:rPr', NS)
            if props is None:
                props = etree.Element(tag('rPr'))
                run.insert(0, props)
            underline = props.find('w:u', NS)
            if underline is None:
                underline = etree.SubElement(props, tag('u'))
            underline.set(tag('val'), 'single' if 'ABCD'[index] == question.answer else 'none')
    if simple:
        offset = 0
        for template, size in groups:
            row = deepcopy(template)
            for child in list(row):
                if child.tag != tag('pPr'):
                    row.remove(child)
            for index in range(size):
                if index:
                    etree.SubElement(etree.SubElement(row, tag('r')), tag('tab'))
                row.extend(child for child in reordered[offset + index][0] if child.tag != tag('pPr'))
            stem.append(row)
            offset += size
    else:
        stem.extend(block for blocks in reordered for block in blocks)
    return stem


def remap_solution(blocks, option_order):
    """Update explicit answer references, without touching mathematical points A–D."""
    mapping = {old: 'ABCD'[new] for new, old in enumerate('ABCD'[i] for i in option_order)}
    pattern = re.compile(r'(?i:\b(?:chọn|đáp\s*án(?:\s*đúng)?(?:\s*là)?|phương\s*án))\s*[:.]?\s*([ABCD])\b')
    for p in paragraphs(blocks):
        nodes = list(p.iter(tag('t')))
        value = ''.join(n.text or '' for n in nodes)
        positions = {m.start(1): mapping[m[1]] for m in pattern.finditer(value)}
        offset = 0
        for node in nodes:
            old = node.text or ''
            node.text = ''.join(positions.get(offset + i, char) for i, char in enumerate(old))
            offset += len(old)
    return blocks


def hide_marks(block, section):
    pattern = re.compile(r'(?<!\S)([ABCD])\s*[.)]' if section == 'I' else r'(?<!\S)([abcd])\s*\)')
    for paragraph in paragraphs([block]):
        value, _ = text_map(paragraph)
        matches = list(pattern.finditer(value)) if section != 'III' else []
        if matches:
            for run in paragraph.iter(tag('r')):
                props = run.find('w:rPr', NS)
                if props is None:
                    props = etree.Element(tag('rPr'))
                    run.insert(0, props)
                for underline in list(props.findall('w:u', NS)):
                    props.remove(underline)
                etree.SubElement(props, tag('u')).set(tag('val'), 'none')
        for highlight in list(paragraph.iter(tag('highlight'))):
            highlight.getparent().remove(highlight)


def paragraph(value):
    p = etree.Element(tag('p'))
    run = etree.SubElement(p, tag('r'))
    etree.SubElement(run, tag('t')).text = value
    return p


def heading_paragraph(value, size=26, bold=True, italic=False, color='000000', after=60):
    p = paragraph(value)
    props = etree.Element(tag('pPr'))
    p.insert(0, props)
    etree.SubElement(props, tag('keepNext'))
    etree.SubElement(props, tag('jc')).set(tag('val'), 'center')
    spacing = etree.SubElement(props, tag('spacing'))
    spacing.set(tag('before'), '0')
    spacing.set(tag('after'), str(after))
    spacing.set(tag('line'), '240')
    spacing.set(tag('lineRule'), 'auto')
    run = p.find('w:r', NS)
    rpr = etree.Element(tag('rPr'))
    run.insert(0, rpr)
    fonts = etree.SubElement(rpr, tag('rFonts'))
    for name in ('ascii', 'hAnsi', 'eastAsia', 'cs'):
        fonts.set(tag(name), 'Times New Roman')
    for name, val in (('b', '1' if bold else '0'), ('i', '1' if italic else '0'), ('color', color), ('sz', str(size))):
        etree.SubElement(rpr, tag(name)).set(tag('val'), val)
    return p


def exam_heading(exam, code, department, school, subject='toan'):
    width = 10000
    if exam.sectpr is not None:
        page = exam.sectpr.find('w:pgSz', NS)
        margins = exam.sectpr.find('w:pgMar', NS)
        if page is not None and margins is not None:
            width = int(page.get(tag('w'), '11906')) - sum(int(margins.get(tag(side), '850')) for side in ('left', 'right'))
    widths = [int(width * .36), width - int(width * .36)]
    table = etree.Element(tag('tbl'))
    props = etree.SubElement(table, tag('tblPr'))
    table_width = etree.SubElement(props, tag('tblW'))
    table_width.set(tag('w'), str(width))
    table_width.set(tag('type'), 'dxa')
    borders = etree.SubElement(props, tag('tblBorders'))
    for side in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        etree.SubElement(borders, tag(side)).set(tag('val'), 'nil')
    etree.SubElement(props, tag('tblLayout')).set(tag('type'), 'fixed')
    grid = etree.SubElement(table, tag('tblGrid'))
    for column_width in widths:
        etree.SubElement(grid, tag('gridCol')).set(tag('w'), str(column_width))
    row = etree.SubElement(table, tag('tr'))
    etree.SubElement(etree.SubElement(row, tag('trPr')), tag('cantSplit'))
    if subject == 'tieng_anh':
        mon_text = 'MÔN: TIẾNG ANH'
        tgian_text = 'Thời gian làm bài: 60 phút'
    else:
        mon_text = 'MÔN: TOÁN'
        tgian_text = 'Thời gian làm bài: 90 phút'
    lines = [
        [heading_paragraph(department.upper(), 24, False), heading_paragraph(school.upper(), 24)],
        [heading_paragraph('ĐỀ THI THỬ TN THPT 2027', 28), heading_paragraph(mon_text, 26),
         heading_paragraph(tgian_text, 24, False, True)],
    ]
    for column_width, content in zip(widths, lines):
        cell = etree.SubElement(row, tag('tc'))
        tcpr = etree.SubElement(cell, tag('tcPr'))
        cell_width = etree.SubElement(tcpr, tag('tcW'))
        cell_width.set(tag('w'), str(column_width))
        cell_width.set(tag('type'), 'dxa')
        etree.SubElement(tcpr, tag('vAlign')).set(tag('val'), 'top')
        cell.extend(content)
    return [table, heading_paragraph(f'Mã đề: {code}', 36, color='FF0000', after=180)]


def render_document(exam, order, code, teacher, department, school):
    root = deepcopy(exam.root)
    body = root.find('w:body', NS)
    for child in list(body):
        body.remove(child)
    body.extend(exam_heading(exam, code, department, school, subject=exam.subject))

    question_counter = 1
    for part, questions in order.items():
        body.extend(deepcopy(exam.headings[part]))
        for q_idx, q in enumerate(questions, 1):
            number = question_counter if exam.subject == 'tieng_anh' else q_idx
            question_counter += 1
            is_mcq = exam._is_mcq_part(part)
            should_shuffle = is_mcq and len(q.options) == 4 and q.option_order != (0, 1, 2, 3)
            blocks = shuffled_blocks(q) if should_shuffle else deepcopy(q.blocks)
            if teacher and part == 'II' and not is_mcq:
                mark_tf_answers(blocks, q.answer)
            renumber(blocks[0], number)
            for block in blocks:
                if not teacher:
                    hide_marks(block, 'I' if is_mcq else part)
                body.append(block)
            if teacher and q.solution:
                solution = deepcopy(q.solution)
                body.extend(remap_solution(solution, q.option_order) if should_shuffle else solution)
    if exam.sectpr is not None:
        body.append(deepcopy(exam.sectpr))
    output = BytesIO()
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name, data in exam.files.items():
            archive.writestr(name, etree.tostring(root, xml_declaration=True, encoding='UTF-8', standalone=True)
                             if name == 'word/document.xml' else data)
    return output.getvalue()


def answer_workbook(variants):
    """TNMaker's official 2025 direct-import matrix, single data sheet."""
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = 'Dữ liệu'
    sheet.append(['Câu\\Mã đề'] + [code for code, _ in variants])
    answers = [[q.answer for questions in order.values() for q in questions] for _, order in variants]
    for index, row in enumerate(zip(*answers), 1):
        sheet.append([index, *row])
    for cell in sheet[1]:
        cell.font = Font(bold=True, color='FFFFFF')
        cell.fill = PatternFill('solid', fgColor='975A16')
    for row in sheet.iter_rows(min_col=2):
        for cell in row:
            cell.number_format = '@'
    sheet.freeze_panes = 'B2'
    sheet.column_dimensions['A'].width = 16
    output = BytesIO()
    workbook.save(output)
    return output.getvalue()


def export_shuffle(content, count=4, start_code='0101', include_solutions=True, seed=None, variant_index=None,
                   department='SỞ GDĐT ................................', school='TRƯỜNG THPT ........................',
                   subject='toan', group_settings=None):
    if not 1 <= count <= 50:
        raise ValueError('Số đề phải từ 1 đến 50.')
    if not re.fullmatch(r'\d{3,4}', start_code) or int(start_code) + count - 1 > 9999:
        raise ValueError('Mã đề phải có 3–4 chữ số và mã cuối không vượt quá 9999.')
    if variant_index is not None and (seed is None or not 0 <= variant_index < count):
        raise ValueError('Chỉ số mã đề hoặc phiên trộn không hợp lệ.')
    department, school = department.strip(), school.strip()
    if not department or not school or max(len(department), len(school)) > 120:
        raise ValueError('Tên Sở GDĐT và Trường THPT cần có nội dung, tối đa 120 ký tự mỗi dòng.')
    exam = Exam(content, subject=subject)
    if exam.errors:
        raise ValueError('\n'.join(exam.errors))

    # Apply web group_settings if provided
    if group_settings:
        if isinstance(group_settings, str):
            try:
                group_settings = json.loads(group_settings)
            except Exception:
                group_settings = None
        if isinstance(group_settings, list):
            for item in group_settings:
                if not isinstance(item, dict):
                    continue
                part = item.get('part')
                idx = item.get('index')
                matching_group = None
                for g in exam.groups:
                    if part and g.name == part:
                        matching_group = g
                        break
                    if idx is not None and g.index == idx:
                        matching_group = g
                        break
                if matching_group:
                    if 'fixed_position' in item:
                        matching_group.fixed_position = bool(item['fixed_position'])
                    if 'mode' in item:
                        matching_group.mode = int(item['mode'])
                    exam.group_configs[matching_group.name] = {
                        'fixed_position': matching_group.fixed_position,
                        'mode': matching_group.mode
                    }
                    exam.freeze_map[matching_group.name] = (matching_group.mode in (0, 2))
        elif isinstance(group_settings, dict):
            for part, cfg in group_settings.items():
                if not isinstance(cfg, dict):
                    continue
                for g in exam.groups:
                    if g.name == part or str(g.index) == str(part):
                        if 'fixed_position' in cfg:
                            g.fixed_position = bool(cfg['fixed_position'])
                        if 'mode' in cfg:
                            g.mode = int(cfg['mode'])
                        exam.group_configs[g.name] = {
                            'fixed_position': g.fixed_position,
                            'mode': g.mode
                        }
                        exam.freeze_map[g.name] = (g.mode in (0, 2))

    rng = random.Random(seed)
    variants, seen = [], set()
    while len(variants) < count:
        if exam.subject == 'tieng_anh':
            floating_indices = [i for i, g in enumerate(exam.groups) if not g.fixed_position]
            if len(floating_indices) > 1:
                shuffled_floating = rng.sample([exam.groups[i] for i in floating_indices], len(floating_indices))
                ordered_groups = list(exam.groups)
                for idx, g in zip(floating_indices, shuffled_floating):
                    ordered_groups[idx] = g
            else:
                ordered_groups = list(exam.groups)
        else:
            ordered_groups = list(exam.groups)

        order = {}
        for g in ordered_groups:
            part = g.name
            qs = g.questions
            if not qs:
                continue

            # Question order:
            # Mode 1 or 3: shuffle questions
            # Mode 0 or 2: keep question order
            shuffle_qs = (g.mode in (1, 3)) if exam.subject == 'tieng_anh' else (not exam.freeze_map.get(part, False))
            if shuffle_qs:
                group_qs = rng.sample(qs, len(qs))
            else:
                group_qs = list(qs)

            # Option order:
            # Mode 2 or 3: shuffle options
            # Mode 0 or 1: keep option order
            shuffle_opts = (g.mode in (2, 3)) if exam.subject == 'tieng_anh' else exam._is_mcq_part(part)

            final_qs = []
            for item in group_qs:
                if shuffle_opts and len(item.options) == 4 and exam._is_mcq_part(part):
                    option_order = tuple(rng.sample(range(4), 4))
                    answer = 'ABCD'[option_order.index('ABCD'.index(item.answer))] if item.answer in 'ABCD' else item.answer
                    final_qs.append(replace(item, answer=answer, option_order=option_order))
                else:
                    final_qs.append(replace(item, option_order=(0, 1, 2, 3)))
            order[part] = final_qs

        signature = tuple(
            (g.name, tuple((q.number, q.option_order) for q in order[g.name]))
            for g in ordered_groups
        )
        if signature in seen:
            continue
        seen.add(signature)
        variants.append((str(int(start_code) + len(variants)).zfill(len(start_code)), order))

    output = BytesIO()
    mapping = {}
    for code, order in variants:
        mapping[code] = {}
        q_counter = 1
        for part, questions in order.items():
            part_list = []
            for q_idx, q in enumerate(questions, 1):
                new_num = q_counter if exam.subject == 'tieng_anh' else q_idx
                q_counter += 1
                item = {
                    'cau_moi': new_num,
                    'cau_goc': q.number,
                    'dap_an': q.answer,
                }
                if part == 'I' or (exam.subject == 'tieng_anh' and len(q.options) == 4):
                    item['phuong_an_moi_sang_goc'] = {new: 'ABCD'[old] for new, old in zip('ABCD', q.option_order)}
                part_list.append(item)
            mapping[code][part] = part_list

    selected = variants if variant_index is None else [variants[variant_index]]
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
        for code, order in selected:
            archive.writestr(f'De_{code}.docx', render_document(exam, order, code, False, department, school))
            if include_solutions:
                archive.writestr(f'loi_giai-{code}.docx', render_document(exam, order, code, True, department, school))
            if output.tell() > MAX_OUTPUT:
                raise ValueError('Một lượt xuất vượt quá 4 MB. Hãy bỏ bản lời giải hoặc giảm dung lượng hình trong đề gốc.')
        archive.writestr('Dap_an_TNMaker_2025.xlsx', answer_workbook(variants))
        archive.writestr('Doi_chieu_cau_goc.json', json.dumps(mapping, ensure_ascii=False, indent=2))

        if exam.subject == 'tieng_anh':
            guide_text = (
                'HƯỚNG DẪN TRỘN ĐỀ MÔN TIẾNG ANH\n'
                '• Đặt các <g> trước các phần trong đề (hoặc cấu hình trực tiếp trên web):\n'
                '  - <g0>: Không trộn cả câu hỏi lẫn đáp án của Question.\n'
                '  - <g1>: Chỉ hoán vị vị trí các Question, đáp án không đảo.\n'
                '  - <g2>: Chỉ hoán vị vị trí các đáp án trong Question, giữ nguyên vị trí Question.\n'
                '  - <g3>: Hoán vị cả câu hỏi lẫn đáp án trong phần đó.\n'
                '• Thêm dấu # trước <g> (ví dụ: <#g0>, <#g1>, <#g2>, <#g3>) để giữ nguyên vị trí phần trong đề.\n'
                '• Không có dấu # thì các phần sẽ được hoán vị vị trí với nhau khi tạo mã đề mới.\n'
                '• Các câu hỏi được đánh số liên tục từ 1 đến hết đề.\n'
                '• De_*.docx: bản học sinh. loi_giai-*.docx: bản giáo viên có đáp án gạch chân.\n'
                '• Dap_an_TNMaker_2025.xlsx: file đáp án nạp trực tiếp vào ứng dụng TNMaker 2025.\n'
                + ('\nLƯU Ý:\n' + '\n'.join(exam.warnings) if exam.warnings else '')
            )
        else:
            guide_text = (
                'Excel dùng mẫu nhập trực tiếp TNMaker 2025, một sheet Dữ liệu.\n'
                'Hàng đầu: Câu\\Mã đề và các mã đề. Cột đầu đánh số liên tục qua các phần.\n'
                'Phần I: A/B/C/D; Phần II: chuỗi bốn ký tự Đ/S theo a,b,c,d; Phần III: số dùng dấu phẩy.\n'
                'Trong TNMaker chọn phiếu 2025, đặt số câu từng phần đúng với đề rồi nhập file Excel.\n'
                'Mẫu chính thức: https://tnmaker.net/nap-dap-an-phieu-tltn-2025/\n'
                'Trộn câu trong cùng phần và trộn A–D ở Phần I; giữ thứ tự a–d ở Phần II.\n'
                'De_*.docx: bản học sinh. loi_giai-*.docx: bản gạch chân đáp án đúng và lời giải.\n'
                + ('\nLƯU Ý:\n' + '\n'.join(exam.warnings) if exam.warnings else '')
            )
        archive.writestr('Huong_dan.txt', guide_text.encode('utf-8'))

    if len(output.getvalue()) > MAX_OUTPUT:
        raise ValueError('ZIP vượt quá 4 MB. Hãy giảm số đề hoặc bỏ bản lời giải.')
    return output.getvalue()
