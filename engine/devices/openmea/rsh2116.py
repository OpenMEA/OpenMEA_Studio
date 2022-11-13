from io import BytesIO

REG_STIM_ENABLE_A = 32
REG_STIM_ENABLE_B = 33
REG_STIM_STEP_SIZE = 34
REG_STIM_BIAS_VOLTAGES = 35
REG_CUR_LIM_CHAGRE_RECOV_VOLTAGE = 36
REG_CUR_LIM_CHARGE_RECOV_CUR_LIMIT = 37
REG_STIM_ON = 42
REG_STIM_POLARITY = 44
REG_CHARGE_RECOV_SWITCH = 46

REG_STIM_NEG_CURRENT_BASE = 64
REG_STIM_POS_CURRENT_BASE = 96

REG_CHIP_ID = 255

STIM_POS_REG_OFFSET = REG_STIM_POS_CURRENT_BASE - REG_STIM_NEG_CURRENT_BASE

STIM_ENABLE_A_MAGIC_NUMBER = 0xaaaa
STIM_ENABLE_B_MAGIC_NUMBER = 0x00ff
STIM_DISABLE_A_MAGIC_NUMBER = 0x0000
STIM_DISABLE_B_MAGIC_NUMBER = 0x0000

STIM_STEP_SIZE_CODES = [
    64 + (19 << 7) + (3 << 13),  # 10 nA
    40 + (40 << 7) + (1 << 13),  # 20 nA
    64 + (40 << 7) + (0 << 13),  # 50 nA
    30 + (20 << 7) + (0 << 13),  # 100 nA
    25 + (10 << 7) + (0 << 13),  # 200 nA
    101 + (3 << 7) + (0 << 13),  # 500 nA
    98 + (1 << 7) + (0 << 13),  # 1 uA
    94 + (0 << 7) + (0 << 13),  # 2 uA
    38 + (0 << 7) + (0 << 13),  # 5 uA
    15 + (0 << 7) + (0 << 13),  # 10 uA
]

STIM_PBIAS_AND_NBIAS = [
    6 + (6 << 4),  # 10 nA
    7 + (7 << 4),  # 20 nA
    7 + (7 << 4),  # 50 nA
    7 + (7 << 4),  # 100 nA
    8 + (8 << 4),  # 200 nA
    9 + (9 << 4),  # 500 nA
    10 + (10 << 4),  # 1 uA
    11 + (11 << 4),  # 2 uA
    14 + (14 << 4),  # 5 uA
    15 + (15 << 4),  # 10 uA
]

STIM_STEP_SIZES = [
    0.000_000_01,
    0.000_000_02,
    0.000_000_05,
    0.000_000_1,
    0.000_000_2,
    0.000_000_5,
    0.000_001,
    0.000_002,
    0.000_005,
    0.000_01,
]

STIM_STEP_SIZE_10_nA = 0
STIM_STEP_SIZE_20_nA = 1
STIM_STEP_SIZE_50_nA = 2
STIM_STEP_SIZE_100_nA = 3
STIM_STEP_SIZE_200_nA = 4
STIM_STEP_SIZE_500_nA = 5
STIM_STEP_SIZE_1_uA = 6
STIM_STEP_SIZE_2_uA = 7
STIM_STEP_SIZE_5_uA = 8
STIM_STEP_SIZE_10_uA = 9


def rsh2116_write_register(register: int, value: int, trigger: bool = False):
    command = 0b10000000000000000000000000000000 + (register << 16) + value

    if trigger:
        command = command + 0b00100000000000000000000000000000

    return command.to_bytes(4, byteorder='little')


def rsh2116_read_register(register: int):
    command = 0b11000000000000000000000000000000 + (register << 16)
    return command.to_bytes(4, byteorder='little')


def rsh2116_write_neg_current(electrode: int, value: int, trigger: bool = False):
    # Default trim (128) plus the magnitude of the impulse.
    write_value = (0b10000000 << 8) + abs(value)
    return rsh2116_write_register(REG_STIM_NEG_CURRENT_BASE + electrode, write_value, trigger)


def rsh2116_write_pos_current(electrode: int, value: int, trigger: bool = False):
    # Default trim (128) plus the magnitude of the impulse.
    write_value = (0b10000000 << 8) + abs(value)
    return rsh2116_write_register(REG_STIM_POS_CURRENT_BASE + electrode, write_value, trigger)


def rsh2116_write_current(electrode: int, value: int, trigger: bool = False):
    register = electrode + (REG_STIM_NEG_CURRENT_BASE if value < 0 else REG_STIM_POS_CURRENT_BASE)
    write_value = (0b10000000 << 8) + abs(value)
    return rsh2116_write_register(register, write_value, trigger)


def rsh2116_set_stim_step_size(step_size_option: int) -> BytesIO:
    commands = BytesIO()
    commands.write(rsh2116_write_register(REG_STIM_ON, 0, trigger=True))  # Stop all stimulation
    commands.write(rsh2116_write_register(REG_STIM_STEP_SIZE, STIM_STEP_SIZE_CODES[step_size_option]))
    commands.write(rsh2116_write_register(REG_STIM_BIAS_VOLTAGES, STIM_PBIAS_AND_NBIAS[step_size_option]))
    commands.write(COMMAND_READ_CHIP_ID)
    return commands


def rsh2116_electrode_bit(electrode_num: int):
    return 1 << electrode_num


COMMAND_STIM_ENABLE_A = rsh2116_write_register(REG_STIM_ENABLE_A, STIM_ENABLE_A_MAGIC_NUMBER)
COMMAND_STIM_ENABLE_B = rsh2116_write_register(REG_STIM_ENABLE_B, STIM_ENABLE_B_MAGIC_NUMBER)
COMMAND_STIM_DISABLE_A = rsh2116_write_register(REG_STIM_ENABLE_A, STIM_DISABLE_A_MAGIC_NUMBER)
COMMAND_STIM_DISABLE_B = rsh2116_write_register(REG_STIM_ENABLE_B, STIM_DISABLE_B_MAGIC_NUMBER)

COMMAND_STOP_STIM = rsh2116_write_register(REG_STIM_ON, 0)

COMMAND_READ_CHIP_ID = rsh2116_read_register(REG_CHIP_ID)
