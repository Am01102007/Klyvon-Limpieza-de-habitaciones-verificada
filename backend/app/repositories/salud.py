from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session


class SaludRepository:
    def __init__(self, sesion: Session) -> None:
        self._sesion = sesion

    def base_disponible(self) -> bool:
        try:
            self._sesion.execute(text("SELECT 1"))
        except SQLAlchemyError:
            return False
        return True
