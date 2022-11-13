import importlib.util
import os


def load_openmea_modules():
    modules_root_dir = os.path.join(os.path.dirname(__file__), 'modules')

    for dir_name in os.listdir(modules_root_dir):
        # Make sure that we have a full path.
        module_full_dir = os.path.join(modules_root_dir, dir_name)

        if not os.path.isdir(module_full_dir):
            continue

        main_py = os.path.join(module_full_dir, 'main.py')
        if not os.path.isfile(main_py):
            continue

        module_name = f'modules.{dir_name}.main'
        spec = importlib.util.spec_from_file_location(module_name, main_py)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        # The module should call openmea_module.register_openmea_module() to register itself.
        # Full list of registered modules should be available in openmea_module.all_openmea_modules
