from slowapi import Limiter
from slowapi.util import get_remote_address

LIMITE_LOGIN = "20/minute"
LIMITE_SESION = "30/minute"
LIMITE_CLAVE = "10/minute"
LIMITE_FOTOS = "120/minute"

limitador = Limiter(key_func=get_remote_address)
