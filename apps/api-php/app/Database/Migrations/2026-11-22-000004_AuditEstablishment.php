<?php
namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * registros_auditoria is a general audit log: entity_id stays VARCHAR because it points to
 * different tables (viajes, vehiculos, usuarios) and keeps legacy identifiers. Isolation comes
 * from establishment_id, which every new record carries.
 */
final class AuditEstablishment extends Migration
{
    public function up()
    {
        // Safe to rerun: the column is added nullable, filled, and only then made mandatory.
        if (!$this->db->fieldExists('establishment_id', 'registros_auditoria')) {
            $this->db->query("ALTER TABLE registros_auditoria ADD establishment_id INT UNSIGNED NULL AFTER id_registro_auditoria");
        }
        // Compare as bytes: legacy identifiers such as 'legacy:12' never trigger numeric casts or collation conflicts.
        $fill = [
            "UPDATE registros_auditoria a JOIN viajes v ON a.entity_type='BITACORA' AND CAST(a.entity_id AS BINARY)=CAST(v.id_viaje AS BINARY)
                SET a.establishment_id=v.establishment_id WHERE a.establishment_id IS NULL",
            "UPDATE registros_auditoria a JOIN folios_viajes_anteriores p ON a.entity_type='BITACORA' AND CAST(a.entity_id AS BINARY)=CAST(p.id_folio_anterior AS BINARY)
                SET a.establishment_id=p.establishment_id WHERE a.establishment_id IS NULL",
            "UPDATE registros_auditoria a JOIN vehiculos v ON a.entity_type='VEHICLE' AND CAST(a.entity_id AS BINARY)=CAST(v.id_vehiculo AS BINARY)
                SET a.establishment_id=v.establishment_id WHERE a.establishment_id IS NULL",
            "UPDATE registros_auditoria a JOIN usuarios u ON a.entity_type='USER' AND CAST(a.entity_id AS BINARY)=CAST(u.id_usuario AS BINARY)
                JOIN funcionarios f ON f.id_funcionario=u.id_funcionario
                SET a.establishment_id=f.establishment_id WHERE a.establishment_id IS NULL",
            // Records whose entity no longer exists belong to the institution of their author.
            "UPDATE registros_auditoria a JOIN usuarios u ON u.id_usuario=a.actor_user_id
                JOIN funcionarios f ON f.id_funcionario=u.id_funcionario
                SET a.establishment_id=f.establishment_id WHERE a.establishment_id IS NULL",
        ];
        foreach ($fill as $sql) $this->db->query($sql);
        // Prototype maintenance records have no author or surviving entity. With a single institution they can only belong to it.
        $institutions = $this->db->table('establecimientos')->select('id_establecimiento')->get()->getResultArray();
        if (count($institutions) === 1) {
            $this->db->table('registros_auditoria')->where('establishment_id', null)->update(['establishment_id'=>$institutions[0]['id_establecimiento']]);
        }
        $missing = (int)$this->db->query("SELECT COUNT(*) AS n FROM registros_auditoria WHERE establishment_id IS NULL")->getRowArray()['n'];
        if ($missing > 0) {
            throw new \RuntimeException("Hay $missing registros de auditoría sin institución identificable. Asígnelos manualmente y reintente.");
        }
        $this->db->query("ALTER TABLE registros_auditoria MODIFY establishment_id INT UNSIGNED NOT NULL,
            ADD KEY auditoria_establecimiento_entidad(establishment_id,entity_type,entity_id),
            ADD CONSTRAINT fk_auditoria_establecimiento FOREIGN KEY(establishment_id) REFERENCES establecimientos(id_establecimiento)");
    }

    public function down()
    {
        $this->db->query("ALTER TABLE registros_auditoria DROP FOREIGN KEY fk_auditoria_establecimiento");
        $this->db->query("ALTER TABLE registros_auditoria DROP KEY auditoria_establecimiento_entidad, DROP COLUMN establishment_id");
    }
}
