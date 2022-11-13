from typing import List
from uuid import uuid4

from engine_step import EngineStep
from stores.data_buffer import DataBuffer


class EnginePipeline:
    def __init__(self, steps: List[EngineStep]):
        self.id = uuid4()
        self.steps = steps
        self.is_first_pipeline_run = True

    def do_step(self):
        result = None
        is_first_step = True

        for step in self.steps:
            was_first_step = is_first_step

            if not is_first_step:
                step.do_step(result)
            else:
                is_first_step = False

            if was_first_step and self.is_first_pipeline_run:
                self.is_first_pipeline_run = False

                if type(step) is DataBuffer:
                    result = step.get_cache()
                    continue

            result = step.result

        return result

    def after_step(self):
        for step in self.steps:
            step.after_step()

    def finalize(self):
        for step in self.steps:
            step.finalize()