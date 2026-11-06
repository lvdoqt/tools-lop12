"""
Bản đồ tọa độ chuẩn (Template Coordinate Map) cho Phiếu trả lời trắc nghiệm
chuẩn Bộ GD&ĐT từ năm 2025 (phieu-cham-2025.pdf).

Kích thước chuẩn (Canonical Size):
- Width: 2328 px
- Height: 3381 px

4 mốc định vị góc (Corner Fiducials):
- Top-Left (TL):     (76.5, 92.5)
- Top-Right (TR):    (2244.5, 92.5)
- Bottom-Left (BL):  (76.5, 3296.5)
- Bottom-Right (BR): (2244.5, 3296.5)
"""

CANONICAL_WIDTH = 2328
CANONICAL_HEIGHT = 3381

TARGET_TL = (76.5, 92.5)
TARGET_TR = (2244.5, 92.5)
TARGET_BL = (76.5, 3296.5)
TARGET_BR = (2244.5, 3296.5)

BUBBLE_RADIUS = 18.0

# -------------------------------------------------------------
# 1. Số báo danh (SBD): 8 cột (0..7), 10 hàng (chữ số 0..9)
# -------------------------------------------------------------
SBD_COL_X = [1593.5, 1641.5, 1689.5, 1737.5, 1784.5, 1830.5, 1878.5, 1925.5]
SBD_ROW_Y = [330.5, 398.5, 466.5, 534.6, 603.4, 671.5, 739.5, 807.5, 875.5, 943.5]


def get_sbd_grid():
    """
    Trả về grid các bóng cho Số báo danh:
    Cấu trúc: { col_index: [ (digit, x, y, r), ... ] }
    """
    grid = {}
    for col_idx, x in enumerate(SBD_COL_X):
        grid[col_idx] = []
        for digit, y in enumerate(SBD_ROW_Y):
            grid[col_idx].append((digit, float(x), float(y), BUBBLE_RADIUS))
    return grid


# -------------------------------------------------------------
# 2. Mã đề thi (MDT): 4 cột (0..3), 10 hàng (chữ số 0..9)
# -------------------------------------------------------------
MDT_COL_X = [2043.5, 2091.5, 2138.5, 2184.5]


def get_mdt_grid():
    """
    Trả về grid các bóng cho Mã đề thi:
    Cấu trúc: { col_index: [ (digit, x, y, r), ... ] }
    """
    grid = {}
    for col_idx, x in enumerate(MDT_COL_X):
        grid[col_idx] = []
        for digit, y in enumerate(SBD_ROW_Y):
            grid[col_idx].append((digit, float(x), float(y), BUBBLE_RADIUS))
    return grid


# -------------------------------------------------------------
# 3. Phần I: 40 câu trắc nghiệm 4 lựa chọn (A, B, C, D)
# 4 cột lớn: Câu 1-10, 11-20, 21-30, 31-40
# -------------------------------------------------------------
P1_COL_STARTS = [177, 687, 1198, 1709]
P1_OPT_DX = [90.5, 193.5, 295.1, 395.5]  # Tương ứng A, B, C, D
P1_Q_DY = [88.5, 140.5, 192.5, 244.8, 297.5, 352.5, 404.8, 456.8, 508.8, 561.5]  # 10 câu mỗi cột


def get_part1_grid():
    """
    Trả về grid các bóng Phần I:
    Cấu trúc: { question_num (1..40): { 'A': (x,y,r), 'B': (x,y,r), 'C': (x,y,r), 'D': (x,y,r) } }
    """
    grid = {}
    options = ['A', 'B', 'C', 'D']
    for col_idx, c_start in enumerate(P1_COL_STARTS):
        for q_idx, dy in enumerate(P1_Q_DY):
            q_num = col_idx * 10 + q_idx + 1
            grid[q_num] = {}
            for opt_idx, dx in enumerate(P1_OPT_DX):
                opt = options[opt_idx]
                grid[q_num][opt] = (float(c_start + dx), float(1192 + dy), BUBBLE_RADIUS)
    return grid


# -------------------------------------------------------------
# 4. Phần II: 8 câu Đúng/Sai (Câu 1 đến 8)
# Mỗi câu có 4 ý a), b), c), d) và 2 lựa chọn Đúng / Sai
# Khối 1: Câu 1 & 2; Khối 2: Câu 3 & 4; Khối 3: Câu 5 & 6; Khối 4: Câu 7 & 8
# -------------------------------------------------------------
P2_COL_STARTS = [177, 687, 1198, 1709]
P2_Q1_DX = [93.1, 193.5]   # Đúng, Sai cho câu lẻ (1, 3, 5, 7)
P2_Q2_DX = [301.5, 397.5]  # Đúng, Sai cho câu chẵn (2, 4, 6, 8)
P2_ROW_DY = [157.0, 209.2, 261.5, 313.8]  # Các ý a, b, c, d


def get_part2_grid():
    """
    Trả về grid các bóng Phần II:
    Cấu trúc: {
      question_num (1..8): {
        'a': { 'Đ': (x,y,r), 'S': (x,y,r) },
        'b': { 'Đ': (x,y,r), 'S': (x,y,r) },
        'c': { 'Đ': (x,y,r), 'S': (x,y,r) },
        'd': { 'Đ': (x,y,r), 'S': (x,y,r) }
      }
    }
    """
    grid = {}
    sub_keys = ['a', 'b', 'c', 'd']

    for block_idx, c_start in enumerate(P2_COL_STARTS):
        # Câu thứ nhất trong block (Câu lẻ: 1, 3, 5, 7)
        q_odd = block_idx * 2 + 1
        grid[q_odd] = {}
        for sub_idx, dy in enumerate(P2_ROW_DY):
            sub = sub_keys[sub_idx]
            grid[q_odd][sub] = {
                'Đ': (float(c_start + P2_Q1_DX[0]), float(1885 + dy), BUBBLE_RADIUS),
                'S': (float(c_start + P2_Q1_DX[1]), float(1885 + dy), BUBBLE_RADIUS),
            }

        # Câu thứ hai trong block (Câu chẵn: 2, 4, 6, 8)
        q_even = block_idx * 2 + 2
        grid[q_even] = {}
        for sub_idx, dy in enumerate(P2_ROW_DY):
            sub = sub_keys[sub_idx]
            grid[q_even][sub] = {
                'Đ': (float(c_start + P2_Q2_DX[0]), float(1885 + dy), BUBBLE_RADIUS),
                'S': (float(c_start + P2_Q2_DX[1]), float(1885 + dy), BUBBLE_RADIUS),
            }
    return grid


# -------------------------------------------------------------
# 5. Phần III: 6 câu Trả lời ngắn (Câu 1 đến 6)
# Mỗi câu có:
# - Dòng dấu âm: '-' ở cột 0
# - Dòng dấu phẩy: ',' ở cột 1 và cột 2
# - 10 dòng chữ số: 0 đến 9 trên cả 4 cột
# -------------------------------------------------------------
P3_COL_STARTS = [182 + i * 326 for i in range(6)]
P3_DIGIT_DX = [66.2, 139.5, 210.3, 280.5]
P3_DIGITS_DY = [277.2 + i * 53.9 for i in range(10)]  # 0 đến 9


def get_part3_grid():
    """
    Trả về grid các bóng Phần III:
    Cấu trúc: {
      question_num (1..6): {
        'minus': (x,y,r),
        'comma_1': (x,y,r), # Dấu phẩy sau cột 0 (ở cột 1)
        'comma_2': (x,y,r), # Dấu phẩy sau cột 1 (ở cột 2)
        'columns': [
           # Mỗi cột trong 4 cột có 10 bóng cho các chữ số 0..9:
           [ (0, x, y, r), (1, x, y, r), ... (9, x, y, r) ],
           ... (4 cột)
        ]
      }
    }
    """
    grid = {}
    for q_idx, c_start in enumerate(P3_COL_STARTS):
        q_num = q_idx + 1
        cols = []
        for col_idx, dx in enumerate(P3_DIGIT_DX):
            col_digits = []
            for digit, dy in enumerate(P3_DIGITS_DY):
                col_digits.append((digit, float(c_start + dx), float(2344 + dy), BUBBLE_RADIUS))
            cols.append(col_digits)

        grid[q_num] = {
            'minus': (float(c_start + 66.2), float(2344 + 166.5), BUBBLE_RADIUS),
            'comma_1': (float(c_start + 139.5), float(2344 + 218.5), BUBBLE_RADIUS),
            'comma_2': (float(c_start + 210.3), float(2344 + 218.5), BUBBLE_RADIUS),
            'columns': cols,
        }
    return grid

