"""Modelo completo con aislamiento por empresa [RNF-08]

Revision ID: 0002
Revises: 0001
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_TABLAS_DE_EMPRESA = (
    "usuario",
    "refresh_token",
    "propiedad",
    "supervisor_propiedad",
    "habitacion",
    "asignacion",
    "limpieza",
    "pausa",
    "revision",
    "dano",
    "dano_historial",
    "foto",
)


def _crear_aislamiento() -> None:
    """RLS: sin `app.empresa_id` fijado en la transacción, ninguna fila es visible."""
    op.execute(
        """
        CREATE FUNCTION empresa_actual() RETURNS uuid
        LANGUAGE sql STABLE
        AS $$ SELECT NULLIF(current_setting('app.empresa_id', true), '')::uuid $$
        """
    )
    op.execute("ALTER TABLE empresa ENABLE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY aislamiento_empresa ON empresa "
        "USING (id = empresa_actual()) WITH CHECK (id = empresa_actual())"
    )
    for tabla in _TABLAS_DE_EMPRESA:
        op.execute(f"ALTER TABLE {tabla} ENABLE ROW LEVEL SECURITY")
        op.execute(
            f"CREATE POLICY aislamiento_empresa ON {tabla} "
            "USING (empresa_id = empresa_actual()) WITH CHECK (empresa_id = empresa_actual())"
        )

    # Las empresas no se crean ni se borran desde la API; el historial solo crece.
    op.execute("REVOKE INSERT, DELETE ON empresa FROM limpieza_app")
    op.execute("REVOKE UPDATE, DELETE ON dano_historial FROM limpieza_app")

    # El login y el borrado diario necesitan ubicar empresas antes de fijar el contexto.
    op.execute(
        """
        CREATE FUNCTION empresa_id_por_codigo(codigo_buscado text) RETURNS uuid
        LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
        AS $$ SELECT id FROM empresa WHERE codigo = codigo_buscado $$
        """
    )
    op.execute(
        """
        CREATE FUNCTION empresas_ids() RETURNS SETOF uuid
        LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
        AS $$ SELECT id FROM empresa $$
        """
    )
    for funcion in ("empresa_id_por_codigo(text)", "empresas_ids()"):
        op.execute(f"REVOKE ALL ON FUNCTION {funcion} FROM PUBLIC")
        op.execute(f"GRANT EXECUTE ON FUNCTION {funcion} TO limpieza_app")


def _eliminar_aislamiento() -> None:
    op.execute("DROP FUNCTION empresas_ids()")
    op.execute("DROP FUNCTION empresa_id_por_codigo(text)")
    for tabla in _TABLAS_DE_EMPRESA:
        op.execute(f"DROP POLICY aislamiento_empresa ON {tabla}")
    op.execute("DROP POLICY aislamiento_empresa ON empresa")
    op.execute("DROP FUNCTION empresa_actual()")


def upgrade() -> None:
    op.create_table(
        "empresa",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("nombre", sa.String(length=120), nullable=False),
        sa.Column("codigo", sa.String(length=20), nullable=False),
        sa.Column(
            "idioma",
            sa.Enum(
                "es",
                "en",
                "pt",
                name="idioma",
                native_enum=False,
                create_constraint=True,
                length=30,
            ),
            nullable=False,
        ),
        sa.Column("plan", sa.String(length=30), nullable=False),
        sa.Column(
            "regla_revision",
            sa.Enum(
                "todo",
                "muestra",
                "riesgo",
                name="regla_revision",
                native_enum=False,
                create_constraint=True,
                length=30,
            ),
            nullable=False,
        ),
        sa.Column("muestra_n", sa.SmallInteger(), nullable=False),
        sa.Column("retencion_fotos_dias", sa.SmallInteger(), nullable=False),
        sa.Column(
            "creado_en", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.CheckConstraint("codigo = upper(codigo)", name=op.f("ck_empresa_codigo_mayusculas")),
        sa.CheckConstraint("muestra_n >= 1", name=op.f("ck_empresa_muestra_n_positivo")),
        sa.CheckConstraint("retencion_fotos_dias >= 1", name=op.f("ck_empresa_retencion_positiva")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_empresa")),
        sa.UniqueConstraint("codigo", name=op.f("uq_empresa_codigo")),
    )
    op.create_table(
        "propiedad",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("empresa_id", sa.Uuid(), nullable=False),
        sa.Column("nombre", sa.String(length=120), nullable=False),
        sa.Column(
            "tipo",
            sa.Enum(
                "hotel", "airbnb", name="tipo", native_enum=False, create_constraint=True, length=30
            ),
            nullable=False,
        ),
        sa.Column("direccion", sa.Text(), nullable=True),
        sa.Column("zona_horaria", sa.String(length=64), nullable=False),
        sa.ForeignKeyConstraint(
            ["empresa_id"],
            ["empresa.id"],
            name=op.f("fk_propiedad_empresa_id_empresa"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_propiedad")),
        sa.UniqueConstraint("empresa_id", "id", name=op.f("uq_propiedad_empresa_id_id")),
    )
    op.create_table(
        "usuario",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("empresa_id", sa.Uuid(), nullable=False),
        sa.Column("nombre_usuario", sa.String(length=60), nullable=False),
        sa.Column("hash_clave", sa.String(length=255), nullable=False),
        sa.Column(
            "tipo_clave",
            sa.Enum(
                "contrasena",
                "pin",
                name="tipo_clave",
                native_enum=False,
                create_constraint=True,
                length=30,
            ),
            nullable=False,
        ),
        sa.Column(
            "rol",
            sa.Enum(
                "admin",
                "supervisor",
                "empleado",
                name="rol",
                native_enum=False,
                create_constraint=True,
                length=30,
            ),
            nullable=False,
        ),
        sa.Column(
            "idioma",
            sa.Enum(
                "es",
                "en",
                "pt",
                name="idioma",
                native_enum=False,
                create_constraint=True,
                length=30,
            ),
            nullable=False,
        ),
        sa.Column("activo", sa.Boolean(), nullable=False),
        sa.Column("intentos_fallidos", sa.SmallInteger(), nullable=False),
        sa.Column("bloqueado_hasta", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "creado_en", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.CheckConstraint(
            "tipo_clave = 'contrasena' OR rol = 'empleado'",
            name=op.f("ck_usuario_pin_solo_empleados"),
        ),
        sa.CheckConstraint("intentos_fallidos >= 0", name=op.f("ck_usuario_intentos_no_negativos")),
        sa.ForeignKeyConstraint(
            ["empresa_id"],
            ["empresa.id"],
            name=op.f("fk_usuario_empresa_id_empresa"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_usuario")),
        sa.UniqueConstraint("empresa_id", "id", name=op.f("uq_usuario_empresa_id_id")),
        sa.UniqueConstraint(
            "empresa_id", "nombre_usuario", name=op.f("uq_usuario_empresa_id_nombre_usuario")
        ),
    )
    op.create_table(
        "habitacion",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("empresa_id", sa.Uuid(), nullable=False),
        sa.Column("propiedad_id", sa.Uuid(), nullable=False),
        sa.Column("nombre", sa.String(length=60), nullable=False),
        sa.Column("tipo", sa.String(length=60), nullable=True),
        sa.Column("fotos_min_entrada", sa.SmallInteger(), nullable=False),
        sa.Column("fotos_min_salida", sa.SmallInteger(), nullable=False),
        sa.Column("activa", sa.Boolean(), nullable=False),
        sa.CheckConstraint(
            "fotos_min_entrada >= 1", name=op.f("ck_habitacion_fotos_min_entrada_positivo")
        ),
        sa.CheckConstraint(
            "fotos_min_salida >= 1", name=op.f("ck_habitacion_fotos_min_salida_positivo")
        ),
        sa.ForeignKeyConstraint(
            ["empresa_id", "propiedad_id"],
            ["propiedad.empresa_id", "propiedad.id"],
            name=op.f("fk_habitacion_empresa_id_propiedad_id_propiedad"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_habitacion")),
        sa.UniqueConstraint("empresa_id", "id", name=op.f("uq_habitacion_empresa_id_id")),
        sa.UniqueConstraint(
            "propiedad_id", "nombre", name=op.f("uq_habitacion_propiedad_id_nombre")
        ),
    )
    op.create_table(
        "refresh_token",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("empresa_id", sa.Uuid(), nullable=False),
        sa.Column("usuario_id", sa.Uuid(), nullable=False),
        sa.Column("hash_token", sa.String(length=64), nullable=False),
        sa.Column("expira_en", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revocado_en", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "creado_en", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["empresa_id", "usuario_id"],
            ["usuario.empresa_id", "usuario.id"],
            name=op.f("fk_refresh_token_empresa_id_usuario_id_usuario"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_refresh_token")),
        sa.UniqueConstraint("hash_token", name=op.f("uq_refresh_token_hash_token")),
    )
    op.create_index(
        op.f("ix_refresh_token_usuario_id"), "refresh_token", ["usuario_id"], unique=False
    )
    op.create_table(
        "supervisor_propiedad",
        sa.Column("usuario_id", sa.Uuid(), nullable=False),
        sa.Column("propiedad_id", sa.Uuid(), nullable=False),
        sa.Column("empresa_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["empresa_id", "propiedad_id"],
            ["propiedad.empresa_id", "propiedad.id"],
            name=op.f("fk_supervisor_propiedad_empresa_id_propiedad_id_propiedad"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["empresa_id", "usuario_id"],
            ["usuario.empresa_id", "usuario.id"],
            name=op.f("fk_supervisor_propiedad_empresa_id_usuario_id_usuario"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("usuario_id", "propiedad_id", name=op.f("pk_supervisor_propiedad")),
    )
    op.create_index(
        op.f("ix_supervisor_propiedad_propiedad_id"),
        "supervisor_propiedad",
        ["propiedad_id"],
        unique=False,
    )
    op.create_table(
        "asignacion",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("empresa_id", sa.Uuid(), nullable=False),
        sa.Column("habitacion_id", sa.Uuid(), nullable=False),
        sa.Column("empleado_id", sa.Uuid(), nullable=False),
        sa.Column("asignado_por", sa.Uuid(), nullable=False),
        sa.Column("fecha", sa.Date(), nullable=False),
        sa.Column("prioridad", sa.SmallInteger(), nullable=False),
        sa.Column("hora_limite", sa.Time(), nullable=True),
        sa.CheckConstraint("prioridad >= 1", name=op.f("ck_asignacion_prioridad_positiva")),
        sa.ForeignKeyConstraint(
            ["empresa_id", "asignado_por"],
            ["usuario.empresa_id", "usuario.id"],
            name=op.f("fk_asignacion_empresa_id_asignado_por_usuario"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["empresa_id", "empleado_id"],
            ["usuario.empresa_id", "usuario.id"],
            name=op.f("fk_asignacion_empresa_id_empleado_id_usuario"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["empresa_id", "habitacion_id"],
            ["habitacion.empresa_id", "habitacion.id"],
            name=op.f("fk_asignacion_empresa_id_habitacion_id_habitacion"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_asignacion")),
        sa.UniqueConstraint(
            "empresa_id", "id", "empleado_id", name=op.f("uq_asignacion_empresa_id_id_empleado_id")
        ),
        sa.UniqueConstraint(
            "habitacion_id",
            "fecha",
            "empleado_id",
            name=op.f("uq_asignacion_habitacion_id_fecha_empleado_id"),
        ),
    )
    op.create_index(
        op.f("ix_asignacion_asignado_por"), "asignacion", ["asignado_por"], unique=False
    )
    op.create_index(
        "ix_asignacion_empleado_id_fecha", "asignacion", ["empleado_id", "fecha"], unique=False
    )
    op.create_table(
        "limpieza",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("empresa_id", sa.Uuid(), nullable=False),
        sa.Column("asignacion_id", sa.Uuid(), nullable=False),
        sa.Column("empleado_id", sa.Uuid(), nullable=False),
        sa.Column(
            "tipo",
            sa.Enum(
                "normal",
                "correccion",
                name="tipo",
                native_enum=False,
                create_constraint=True,
                length=30,
            ),
            nullable=False,
        ),
        sa.Column("limpieza_origen_id", sa.Uuid(), nullable=True),
        sa.Column("inicio", sa.DateTime(timezone=True), nullable=True),
        sa.Column("fin", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duracion_neta_seg", sa.Integer(), nullable=True),
        sa.Column(
            "estado_trabajo",
            sa.Enum(
                "pendiente",
                "en_curso",
                "enviada",
                name="estado_trabajo",
                native_enum=False,
                create_constraint=True,
                length=30,
            ),
            nullable=False,
        ),
        sa.Column("requiere_revision", sa.Boolean(), nullable=False),
        sa.Column(
            "estado_revision",
            sa.Enum(
                "no_requerida",
                "pendiente",
                "aprobada",
                "rechazada",
                name="estado_revision",
                native_enum=False,
                create_constraint=True,
                length=30,
            ),
            nullable=False,
        ),
        sa.CheckConstraint(
            "(estado_trabajo = 'pendiente' AND inicio IS NULL AND fin IS NULL"
            " AND duracion_neta_seg IS NULL)"
            " OR (estado_trabajo = 'en_curso' AND inicio IS NOT NULL AND fin IS NULL"
            " AND duracion_neta_seg IS NULL)"
            " OR (estado_trabajo = 'enviada' AND inicio IS NOT NULL AND fin IS NOT NULL"
            " AND duracion_neta_seg IS NOT NULL)",
            name=op.f("ck_limpieza_tiempos_segun_estado"),
        ),
        sa.CheckConstraint(
            "(tipo = 'normal') = (limpieza_origen_id IS NULL)",
            name=op.f("ck_limpieza_origen_solo_en_correccion"),
        ),
        sa.CheckConstraint("duracion_neta_seg >= 0", name=op.f("ck_limpieza_duracion_no_negativa")),
        sa.CheckConstraint("fin > inicio", name=op.f("ck_limpieza_fin_posterior_a_inicio")),
        sa.ForeignKeyConstraint(
            ["empresa_id", "asignacion_id", "empleado_id"],
            ["asignacion.empresa_id", "asignacion.id", "asignacion.empleado_id"],
            name=op.f("fk_limpieza_empresa_id_asignacion_id_empleado_id_asignacion"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["empresa_id", "limpieza_origen_id"],
            ["limpieza.empresa_id", "limpieza.id"],
            name=op.f("fk_limpieza_empresa_id_limpieza_origen_id_limpieza"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_limpieza")),
        sa.UniqueConstraint("empresa_id", "id", name=op.f("uq_limpieza_empresa_id_id")),
    )
    op.create_index("ix_limpieza_asignacion_id", "limpieza", ["asignacion_id"], unique=False)
    op.create_index("ix_limpieza_estado_revision", "limpieza", ["estado_revision"], unique=False)
    op.create_index(
        "uq_limpieza_correccion_por_origen",
        "limpieza",
        ["limpieza_origen_id"],
        unique=True,
        postgresql_where=sa.text("limpieza_origen_id IS NOT NULL"),
    )
    op.create_index(
        "uq_limpieza_empleado_abierta",
        "limpieza",
        ["empleado_id"],
        unique=True,
        postgresql_where=sa.text("estado_trabajo = 'en_curso'"),
    )
    op.create_index(
        "uq_limpieza_normal_por_asignacion",
        "limpieza",
        ["asignacion_id"],
        unique=True,
        postgresql_where=sa.text("tipo = 'normal'"),
    )
    op.create_table(
        "dano",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("empresa_id", sa.Uuid(), nullable=False),
        sa.Column("limpieza_id", sa.Uuid(), nullable=False),
        sa.Column(
            "categoria",
            sa.Enum(
                "rotura",
                "mancha",
                "faltante",
                "aparato",
                "otro",
                name="categoria",
                native_enum=False,
                create_constraint=True,
                length=30,
            ),
            nullable=False,
        ),
        sa.Column(
            "gravedad",
            sa.Enum(
                "leve",
                "urgente",
                name="gravedad",
                native_enum=False,
                create_constraint=True,
                length=30,
            ),
            nullable=False,
        ),
        sa.Column("nota", sa.Text(), nullable=True),
        sa.Column(
            "estado",
            sa.Enum(
                "abierto",
                "en_reparacion",
                "resuelto",
                name="estado",
                native_enum=False,
                create_constraint=True,
                length=30,
            ),
            nullable=False,
        ),
        sa.Column("creado_en", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["empresa_id", "limpieza_id"],
            ["limpieza.empresa_id", "limpieza.id"],
            name=op.f("fk_dano_empresa_id_limpieza_id_limpieza"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_dano")),
        sa.UniqueConstraint("empresa_id", "id", name=op.f("uq_dano_empresa_id_id")),
    )
    op.create_index("ix_dano_estado", "dano", ["estado"], unique=False)
    op.create_index("ix_dano_limpieza_id", "dano", ["limpieza_id"], unique=False)
    op.create_table(
        "pausa",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("empresa_id", sa.Uuid(), nullable=False),
        sa.Column("limpieza_id", sa.Uuid(), nullable=False),
        sa.Column(
            "motivo",
            sa.Enum(
                "descanso",
                "falta_insumos",
                "huesped_en_habitacion",
                name="motivo",
                native_enum=False,
                create_constraint=True,
                length=30,
            ),
            nullable=False,
        ),
        sa.Column("inicio", sa.DateTime(timezone=True), nullable=False),
        sa.Column("fin", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("fin >= inicio", name=op.f("ck_pausa_fin_no_anterior_a_inicio")),
        sa.ForeignKeyConstraint(
            ["empresa_id", "limpieza_id"],
            ["limpieza.empresa_id", "limpieza.id"],
            name=op.f("fk_pausa_empresa_id_limpieza_id_limpieza"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_pausa")),
    )
    op.create_index("ix_pausa_limpieza_id", "pausa", ["limpieza_id"], unique=False)
    op.create_index(
        "uq_pausa_abierta_por_limpieza",
        "pausa",
        ["limpieza_id"],
        unique=True,
        postgresql_where=sa.text("fin IS NULL"),
    )
    op.create_table(
        "revision",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("empresa_id", sa.Uuid(), nullable=False),
        sa.Column("limpieza_id", sa.Uuid(), nullable=False),
        sa.Column("supervisor_id", sa.Uuid(), nullable=False),
        sa.Column(
            "resultado",
            sa.Enum(
                "aprobada",
                "rechazada",
                name="resultado",
                native_enum=False,
                create_constraint=True,
                length=30,
            ),
            nullable=False,
        ),
        sa.Column("comentario", sa.Text(), nullable=True),
        sa.Column("revisado_en", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "resultado <> 'rechazada' OR length(trim(comentario)) > 0",
            name=op.f("ck_revision_comentario_si_rechaza"),
        ),
        sa.ForeignKeyConstraint(
            ["empresa_id", "limpieza_id"],
            ["limpieza.empresa_id", "limpieza.id"],
            name=op.f("fk_revision_empresa_id_limpieza_id_limpieza"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["empresa_id", "supervisor_id"],
            ["usuario.empresa_id", "usuario.id"],
            name=op.f("fk_revision_empresa_id_supervisor_id_usuario"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_revision")),
        sa.UniqueConstraint("limpieza_id", name=op.f("uq_revision_limpieza_id")),
    )
    op.create_index(op.f("ix_revision_supervisor_id"), "revision", ["supervisor_id"], unique=False)
    op.create_table(
        "dano_historial",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("empresa_id", sa.Uuid(), nullable=False),
        sa.Column("dano_id", sa.Uuid(), nullable=False),
        sa.Column("usuario_id", sa.Uuid(), nullable=False),
        sa.Column(
            "estado_anterior",
            sa.Enum(
                "abierto",
                "en_reparacion",
                "resuelto",
                name="estado_anterior",
                native_enum=False,
                create_constraint=True,
                length=30,
            ),
            nullable=False,
        ),
        sa.Column(
            "estado_nuevo",
            sa.Enum(
                "abierto",
                "en_reparacion",
                "resuelto",
                name="estado_nuevo",
                native_enum=False,
                create_constraint=True,
                length=30,
            ),
            nullable=False,
        ),
        sa.Column("cambiado_en", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["empresa_id", "dano_id"],
            ["dano.empresa_id", "dano.id"],
            name=op.f("fk_dano_historial_empresa_id_dano_id_dano"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["empresa_id", "usuario_id"],
            ["usuario.empresa_id", "usuario.id"],
            name=op.f("fk_dano_historial_empresa_id_usuario_id_usuario"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_dano_historial")),
    )
    op.create_index("ix_dano_historial_dano_id", "dano_historial", ["dano_id"], unique=False)
    op.create_index("ix_dano_historial_usuario_id", "dano_historial", ["usuario_id"], unique=False)
    op.create_table(
        "foto",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("empresa_id", sa.Uuid(), nullable=False),
        sa.Column("limpieza_id", sa.Uuid(), nullable=False),
        sa.Column("dano_id", sa.Uuid(), nullable=True),
        sa.Column(
            "momento",
            sa.Enum(
                "entrada",
                "salida",
                "dano",
                name="momento",
                native_enum=False,
                create_constraint=True,
                length=30,
            ),
            nullable=False,
        ),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("tomada_en", sa.DateTime(timezone=True), nullable=False),
        sa.Column("tamano_kb", sa.Integer(), nullable=False),
        sa.CheckConstraint(
            "(momento = 'dano') = (dano_id IS NOT NULL)", name=op.f("ck_foto_dano_solo_si_momento")
        ),
        sa.CheckConstraint("tamano_kb > 0", name=op.f("ck_foto_tamano_positivo")),
        sa.ForeignKeyConstraint(
            ["empresa_id", "dano_id"],
            ["dano.empresa_id", "dano.id"],
            name=op.f("fk_foto_empresa_id_dano_id_dano"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["empresa_id", "limpieza_id"],
            ["limpieza.empresa_id", "limpieza.id"],
            name=op.f("fk_foto_empresa_id_limpieza_id_limpieza"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_foto")),
    )
    op.create_index("ix_foto_dano_id", "foto", ["dano_id"], unique=False)
    op.create_index("ix_foto_limpieza_id", "foto", ["limpieza_id"], unique=False)
    op.create_index("ix_foto_tomada_en", "foto", ["tomada_en"], unique=False)

    _crear_aislamiento()


def downgrade() -> None:
    _eliminar_aislamiento()
    op.drop_index("ix_foto_tomada_en", table_name="foto")
    op.drop_index("ix_foto_limpieza_id", table_name="foto")
    op.drop_index("ix_foto_dano_id", table_name="foto")
    op.drop_table("foto")
    op.drop_index("ix_dano_historial_usuario_id", table_name="dano_historial")
    op.drop_index("ix_dano_historial_dano_id", table_name="dano_historial")
    op.drop_table("dano_historial")
    op.drop_index(op.f("ix_revision_supervisor_id"), table_name="revision")
    op.drop_table("revision")
    op.drop_index(
        "uq_pausa_abierta_por_limpieza", table_name="pausa", postgresql_where=sa.text("fin IS NULL")
    )
    op.drop_index("ix_pausa_limpieza_id", table_name="pausa")
    op.drop_table("pausa")
    op.drop_index("ix_dano_limpieza_id", table_name="dano")
    op.drop_index("ix_dano_estado", table_name="dano")
    op.drop_table("dano")
    op.drop_index(
        "uq_limpieza_normal_por_asignacion",
        table_name="limpieza",
        postgresql_where=sa.text("tipo = 'normal'"),
    )
    op.drop_index(
        "uq_limpieza_empleado_abierta",
        table_name="limpieza",
        postgresql_where=sa.text("estado_trabajo = 'en_curso'"),
    )
    op.drop_index(
        "uq_limpieza_correccion_por_origen",
        table_name="limpieza",
        postgresql_where=sa.text("limpieza_origen_id IS NOT NULL"),
    )
    op.drop_index("ix_limpieza_estado_revision", table_name="limpieza")
    op.drop_index("ix_limpieza_asignacion_id", table_name="limpieza")
    op.drop_table("limpieza")
    op.drop_index("ix_asignacion_empleado_id_fecha", table_name="asignacion")
    op.drop_index(op.f("ix_asignacion_asignado_por"), table_name="asignacion")
    op.drop_table("asignacion")
    op.drop_index(op.f("ix_supervisor_propiedad_propiedad_id"), table_name="supervisor_propiedad")
    op.drop_table("supervisor_propiedad")
    op.drop_index(op.f("ix_refresh_token_usuario_id"), table_name="refresh_token")
    op.drop_table("refresh_token")
    op.drop_table("habitacion")
    op.drop_table("usuario")
    op.drop_table("propiedad")
    op.drop_table("empresa")
