import uuid


class EngineStepConfig:
    def __init__(self):
        pass


class EngineStep:
    def __init__(self):
        self.id = uuid.uuid4()
        self.result = None

    def configure(self, config: EngineStepConfig, engine) -> None:
        pass

    def do_step(self, data) -> None:
        pass

    def after_step(self) -> None:
        pass

    def finalize(self) -> None:
        pass
