<?php
namespace App\Libraries;

use CodeIgniter\Database\BaseConnection;

/** Copies old Pulso records without assuming UUIDs can be reused as numeric keys. */
final class LegacyTripImport
{
    public const TABLES = ['establishments', 'users', 'vehicles', 'cost_centers', 'bitacora_entries',
        'service_legs', 'service_address_revisions', 'sessions', 'audit_logs'];

    private array $ids = [];

    public function __construct(private BaseConnection $db, private string $prefix = '') {}

    private function insert(string $table, array $row): string
    {
        if (!$this->db->table($this->prefix . $table)->insert($row)) {
            throw new \RuntimeException("No se pudo importar $table.");
        }
        return (string)$this->db->insertID();
    }

    private function id(string $table, mixed $oldId): ?string
    {
        if ($oldId === null) return null;
        return $this->ids[$table][(string)$oldId] ?? throw new \RuntimeException("Referencia histórica inexistente en $table.");
    }

    private function fields(array $row, string $fields): array
    {
        return array_intersect_key($row, array_flip(explode(' ', $fields)));
    }

    public function copy(callable $rows): void
    {
        $roles = [];
        foreach ([
            'ADMIN' => ['Administración', 'Gestiona los viajes y la flota del establecimiento.'],
            'DRIVER' => ['Chofer', 'Registra y opera los viajes asignados.'],
            'SUPERVISOR' => ['Jefatura de Movilización', 'Perfil institucional de supervisión.'],
            'DISPATCHER' => ['Despacho', 'Perfil institucional de coordinación y digitación.'],
            'REQUESTER' => ['Solicitante', 'Perfil institucional para solicitudes de viaje.'],
        ] as $code => [$name, $description]) {
            $existing = $this->db->table($this->prefix . 'roles')->where('codigo', $code)->get()->getRowArray();
            $roles[$code] = $existing['id_rol'] ?? $this->insert('roles', ['codigo'=>$code, 'nombre_rol'=>$name, 'descripcion'=>$description]);
        }
        foreach ($rows('establishments') as $row) {
            $this->ids['establishments'][$row['id']] = $this->insert('establecimientos',
                $this->fields($row, 'code name timezone active created_at updated_at'));
        }
        foreach ($rows('users') as $row) {
            $tenant = $this->id('establishments', $row['establishment_id']);
            $staff = $this->insert('funcionarios', ['establishment_id'=>$tenant, 'nombre'=>$row['full_name']]);
            $this->ids['users'][$row['id']] = $this->insert('usuarios', $this->fields($row,
                'username roster_code full_name password_hash active failed_login_attempts locked_until rut clave_unica_sub auth_provider created_at updated_at') +
                ['establishment_id'=>$tenant, 'id_funcionario'=>$staff, 'id_rol'=>$roles[$row['role']]]);
        }
        foreach ($rows('vehicles') as $row) {
            $catalog = VehicleCatalog::ids($this->db, $row['vehicle_type'] ?? null, $row['model'] ?? null, null, $this->prefix);
            $this->ids['vehicles'][$row['id']] = $this->insert('vehiculos', $catalog +
                $this->fields($row, 'license_plate current_odometer_km year active created_at updated_at') +
                ['establishment_id'=>$this->id('establishments', $row['establishment_id']), 'codigo_movil'=>$row['role_code']]);
        }
        foreach ($rows('cost_centers') as $row) {
            $this->ids['cost_centers'][$row['id']] = $this->insert('centros_costos',
                $this->fields($row, 'code name active created_at updated_at') +
                ['establishment_id'=>$this->id('establishments', $row['establishment_id'])]);
        }

        $legs = [];
        foreach ($rows('service_legs') as $leg) $legs[$leg['service_id']][] = $leg;
        foreach ($rows('bitacora_entries') as $row) {
            if (!empty($row['closure_pending'])) throw new \RuntimeException('Cierre los viajes históricos pendientes antes de importar.');
            $this->copyTrip($row, $legs[$row['id']] ?? []);
        }
        foreach ($rows('service_address_revisions') as $row) {
            $this->insert('revisiones_direccion', $this->fields($row, 'revision address source created_at') +
                ['service_id'=>$this->id('bitacora_entries', $row['service_id']), 'actor_user_id'=>$this->id('users', $row['actor_user_id'] ?? null)]);
        }
        foreach ($rows('sessions') as $row) {
            $this->insert('sesiones', $this->fields($row, 'token_hash expires_at revoked_at created_at last_seen_at') +
                ['user_id'=>$this->id('users', $row['user_id'])]);
        }
        foreach ($rows('audit_logs') as $row) {
            $type = match ($row['entity_type']) {
                'USER' => 'users', 'VEHICLE' => 'vehicles', 'BITACORA' => 'bitacora_entries', default => null,
            };
            $oldId = (string)$row['entity_id'];
            $this->insert('registros_auditoria', $this->fields($row, 'entity_type action before_data after_data ip_address created_at') +
                ['actor_user_id'=>$this->id('users', $row['actor_user_id'] ?? null),
                 'entity_id'=>($type === null ? null : ($this->ids[$type][$oldId] ?? null)) ?? 'legacy:' . $oldId]);
        }
    }

    private function copyTrip(array $row, array $legs): void
    {
        usort($legs, fn($a, $b) => [$a['started_at'], $a['ended_at'] === null, $a['ended_at'], $a['id']]
            <=> [$b['started_at'], $b['ended_at'] === null, $b['ended_at'], $b['id']]);
        $shared = [
            'establishment_id'=>$this->id('establishments', $row['establishment_id']),
            'cost_center_id'=>$this->id('cost_centers', $row['cost_center_id'] ?? null),
            'created_by_user_id'=>$this->id('users', $row['created_by_user_id'] ?? null),
            'destino'=>$row['service_address'], 'actividad'=>$row['action_performed'],
            'origin'=>'LEGACY', 'cancelled_at'=>$row['cancelled_at'] ?? null, 'void_reason'=>$row['void_reason'] ?? null,
        ];
        $previous = null;
        foreach ($legs ?: [null] as $leg) {
            $status = $row['status'];
            if ($leg !== null && $status !== 'CANCELLED') $status = $leg['ended_at'] === null ? 'IN_PROGRESS' : 'COMPLETED';
            $id = $this->insert('viajes', $shared + [
                'driver_id'=>$this->id('users', $leg['driver_id'] ?? $row['driver_id'] ?? null),
                'vehicle_id'=>$this->id('vehicles', $leg['vehicle_id'] ?? $row['vehicle_id'] ?? null),
                'started_at'=>$leg === null ? ($row['started_at'] ?? null) : $leg['started_at'],
                'ended_at'=>$leg === null ? ($row['ended_at'] ?? null) : $leg['ended_at'],
                'departure_odometer_km'=>$leg['departure_odometer_km'] ?? null,
                'arrival_odometer_km'=>$leg === null ? ($row['odometer_km'] ?? null) : ($leg['arrival_odometer_km'] ?? null),
                'id_viaje_anterior'=>$previous, 'status'=>$status, 'version'=>$row['version'] ?? 0,
                'created_at'=>$previous === null ? ($row['created_at'] ?? null) : $leg['started_at'],
                'updated_at'=>$row['updated_at'] ?? null,
            ]);
            if ($previous === null) {
                $this->ids['bitacora_entries'][$row['id']] = $id;
            } else {
                $this->insert('revisiones_direccion', ['service_id'=>$id, 'revision'=>1,
                    'address'=>$shared['destino'], 'source'=>'LEGACY', 'created_at'=>$leg['started_at']]);
            }
            $previous = $id;
        }
    }
}
