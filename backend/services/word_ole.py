"""MathType compound storage readable by Windows IStorage, not just ZIP parsers."""

import struct
from uuid import UUID

from docx_equation.mathtype.ole import (
    _compobj_stream, _equation_native_stream, _obj_info_stream, _ole_stream,
)

FREE = 0xFFFFFFFF
END = 0xFFFFFFFE
FAT = 0xFFFFFFFD
MATHTYPE_CLSID = UUID('0002ce03-0000-0000-c000-000000000046')


def build_equation_ole(mtef):
    # CFB orders names by UTF-16 length, then uppercase name. The upstream
    # writer emits an unsorted linked list and a zero CLSID; Windows rejects it.
    streams = [
        ('\x01Ole', _ole_stream()),
        ('\x01CompObj', _compobj_stream('Equation.DSMT4')),
        ('\x03ObjInfo', _obj_info_stream()),
        ('Equation Native', _equation_native_stream(mtef)),
    ]
    sectors, chains, mini_fat, mini_data, starts = [], [], [], bytearray(), []

    def allocate(data):
        start = len(sectors)
        count = (len(data) + 511) // 512
        for offset in range(count):
            sectors.append(data[offset * 512:(offset + 1) * 512].ljust(512, b'\0'))
            chains.append(start + offset + 1 if offset + 1 < count else END)
        return start if count else END

    for _, data in streams:
        if len(data) >= 4096:
            starts.append(allocate(data))
        else:
            start = len(mini_fat)
            count = (len(data) + 63) // 64
            starts.append(start)
            mini_data.extend(data.ljust(count * 64, b'\0'))
            mini_fat.extend(start + i + 1 if i + 1 < count else END for i in range(count))
    mini_start = allocate(bytes(mini_data))
    mini_fat_start = allocate(b''.join(struct.pack('<I', entry) for entry in mini_fat).ljust(
        ((len(mini_fat) + 127) // 128) * 512, b'\xff'))

    def entry(name, kind, start, size, left=FREE, right=FREE, child=FREE, color=1):
        result = bytearray(128)
        encoded = name.encode('utf-16le') + b'\0\0'
        result[:len(encoded)] = encoded
        struct.pack_into('<HBBIII', result, 64, len(encoded), kind, color, left, right, child)
        if kind == 5:
            result[80:96] = MATHTYPE_CLSID.bytes_le
        struct.pack_into('<IQ', result, 116, start, size)
        return result

    # Balanced red-black tree: 2 black, children 1/3 black, 4 red under 3.
    directory = entry('Root Entry', 5, mini_start, len(mini_data), child=2)
    for index, (name, data) in enumerate(streams):
        left, right, color = [(FREE, FREE, 1), (1, 3, 1), (FREE, 4, 1), (FREE, FREE, 0)][index]
        directory += entry(name, 2, starts[index], len(data), left, right, color=color)
    directory_start = allocate(bytes(directory))
    fat_count = 1
    while fat_count * 128 < len(sectors) + fat_count:
        fat_count += 1
    if fat_count > 109:
        raise ValueError('Công thức MathType vượt quá kích thước hỗ trợ.')
    fat_start = len(sectors)
    chains.extend([FAT] * fat_count)
    fat_data = b''.join(struct.pack('<I', value) for value in chains).ljust(fat_count * 512, b'\xff')

    header = bytearray(512)
    header[:8] = bytes.fromhex('d0cf11e0a1b11ae1')
    struct.pack_into('<HHHHH', header, 24, 0x003E, 3, 0xFFFE, 9, 6)
    struct.pack_into('<IIIIIIIII', header, 40, 0, fat_count, directory_start, 0,
                     4096, mini_fat_start, (len(mini_fat) + 127) // 128, END, 0)
    for index in range(109):
        struct.pack_into('<I', header, 76 + index * 4, fat_start + index if index < fat_count else FREE)
    return bytes(header) + b''.join(sectors) + fat_data
