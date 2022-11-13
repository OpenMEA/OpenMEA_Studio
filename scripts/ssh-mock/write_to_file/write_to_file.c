#include <unistd.h>
#include <fcntl.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <sys/stat.h>
#include <errno.h>

int main(int argc, char *argv[]) {
    int file;
    size_t input_size;
    unsigned char *buffer;
    size_t buffer_size;
    char encoded_byte[3];
    unsigned char byte_value;
    size_t i;

    if (argc != 3 && argc != 4) {
        printf("Usage:  write_to_file <file> <hex_data> [--append]\n");
        printf("Optional argument '--append' can be used for debugging.\n");
        printf("Do not use it to write to an actual device.\n");
        exit(1);
    }

    input_size = strlen(argv[2]);
    if (input_size % 2) {
        printf("input must have an even number of characters\n");
        exit(1);
    }

    int is_append_mode = 0;
    if (argc == 4) {
        if (strcmp(argv[3], "--append") != 0) {
            printf("Third argument can only be '--append'\n");
            exit(1);
        }

        is_append_mode = 1;
    }

    if (input_size == 0) {
        /* This may happen. */
        exit(0);
    }

    /* Convert the input to binary. */
    buffer_size = input_size / 2;
    buffer = malloc(buffer_size);
    encoded_byte[2] = 0;

    for (i = 0; i < buffer_size; i++) {
        encoded_byte[0] = argv[2][2*i];
        encoded_byte[1] = argv[2][2*i + 1];
        byte_value = (unsigned char) strtoul(encoded_byte, NULL, 16);
        buffer[i] = byte_value;
    }

    /* Write to the target file. */
    int open_flags = O_WRONLY;
    if (is_append_mode) {
        open_flags |= (O_APPEND | O_CREAT);
    }

    mode_t access_if_created = S_IRUSR | S_IWUSR | S_IRGRP | S_IWGRP | S_IROTH | S_IWOTH;

    file = open(argv[1], open_flags, access_if_created);
    
    if (file < 0) {
        int err = errno;
        printf("Could not open file %s for writing: %s\n", argv[1], strerror(err));
        exit(1);
    }

    write(file, buffer, buffer_size);
    close(file);
    free(buffer);
    return 0;
}