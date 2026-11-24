<?php
namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

final class StopActivities extends Migration
{
    public function up()
    {
        if ($this->db->fieldExists('actividad', 'viajes_destinos')) {
            return;
        }
        $this->db->query(
            'ALTER TABLE viajes_destinos
                ADD actividad VARCHAR(250) NULL AFTER direccion,
                ADD id_usuario_registro INT UNSIGNED NULL AFTER actividad,
                ADD fecha_registro DATETIME(3) NULL AFTER id_usuario_registro,
                ADD CONSTRAINT fk_destino_usuario_registro FOREIGN KEY (id_usuario_registro)
                    REFERENCES usuarios (id_usuario)',
        );
    }

    public function down()
    {
        throw new \RuntimeException(
            'Restaurar el respaldo previo para volver al esquema anterior.',
        );
    }
}
