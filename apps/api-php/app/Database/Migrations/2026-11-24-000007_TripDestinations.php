<?php
namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

final class TripDestinations extends Migration
{
    public function up()
    {
        if (!$this->db->tableExists('viajes_destinos')) {
            $this->db->query(
                'CREATE TABLE viajes_destinos (
                    id_viaje_destino INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    id_establecimiento INT UNSIGNED NOT NULL,
                    id_viaje INT UNSIGNED NOT NULL,
                    orden SMALLINT UNSIGNED NOT NULL,
                    direccion VARCHAR(350) NOT NULL,
                    UNIQUE KEY uq_id_viaje_orden (id_viaje, orden),
                    KEY ix_id_establecimiento_id_viaje (id_establecimiento, id_viaje),
                    CONSTRAINT fk_destino_viaje FOREIGN KEY (id_establecimiento, id_viaje)
                        REFERENCES viajes (id_establecimiento, id_viaje) ON DELETE CASCADE,
                    CHECK (orden >= 1)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
            );
        }
        if ($this->db->fieldExists('destino', 'viajes')) {
            $this->db->query(
                'INSERT INTO viajes_destinos (id_establecimiento, id_viaje, orden, direccion)
                SELECT id_establecimiento, id_viaje, 1, destino FROM viajes',
            );
            $this->db->query('ALTER TABLE viajes DROP COLUMN destino');
        }
        $this->db->query('ALTER TABLE revisiones_direccion MODIFY direccion TEXT NOT NULL');
    }

    public function down()
    {
        throw new \RuntimeException(
            'Restaurar el respaldo previo para volver al esquema anterior.',
        );
    }
}
