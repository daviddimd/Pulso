<?php
namespace App\Libraries;

use CodeIgniter\Database\BaseConnection;

final class LegacyTripImport
{
    public const TABLES = [
        'establishments',
        'users',
        'vehicles',
        'cost_centers',
        'bitacora_entries',
        'service_legs',
        'service_address_revisions',
        'sessions',
        'audit_logs',
    ];

    private array $ids = [];
    private bool $domain = false;
    private array $tripTenants = [];

    public function __construct(private BaseConnection $db, private string $prefix = '') {}

    private function insert(string $table, array $row): string
    {
        if ($this->domain) {
            $row = ColumnNames::translate($table, $row);
        }
        if (!$this->db->table($this->prefix . $table)->insert($row)) {
            throw new \RuntimeException("No se pudo importar $table.");
        }
        return (string) $this->db->insertID();
    }

    private function id(string $table, mixed $oldId): ?string
    {
        if ($oldId === null) {
            return null;
        }
        return $this->ids[$table][(string) $oldId] ??
            throw new \RuntimeException("Referencia histórica inexistente en $table.");
    }

    private function fields(array $row, string $fields): array
    {
        return array_intersect_key($row, array_flip(explode(' ', $fields)));
    }

    public function copy(callable $rows): void
    {
        $this->domain = $this->prefix === '' && $this->db->tableExists('viajes_tramos');
        $roles = [];
        foreach (
            [
                'ADMIN' => [
                    'Administración',
                    'Gestiona los viajes y la flota del establecimiento.',
                ],
                'DRIVER' => ['Chofer', 'Registra y opera los viajes asignados.'],
                'SUPERVISOR' => [
                    'Jefatura de Movilización',
                    'Perfil institucional de supervisión.',
                ],
                'DISPATCHER' => ['Despacho', 'Perfil institucional de coordinación y digitación.'],
                'REQUESTER' => ['Solicitante', 'Perfil institucional para solicitudes de viaje.'],
            ]
            as $code => [$name, $description]
        ) {
            $existing = $this->db
                ->table($this->prefix . 'roles')
                ->where('codigo', $this->domain ? Codes::stored(Codes::ROLE, $code) : $code)
                ->get()
                ->getRowArray();
            $roles[$code] =
                $existing['id_rol'] ??
                $this->insert('roles', [
                    'codigo' => $code,
                    'nombre_rol' => $name,
                    'descripcion' => $description,
                ]);
        }
        foreach ($rows('establishments') as $row) {
            $this->ids['establishments'][$row['id']] = $this->insert(
                'establecimientos',
                $this->fields($row, 'code name timezone active created_at updated_at'),
            );
        }
        foreach ($rows('users') as $row) {
            $tenant = $this->id('establishments', $row['establishment_id']);
            $staff = $this->insert(
                'funcionarios',
                ['establishment_id' => $tenant, 'nombre' => $row['full_name']] +
                    ($this->domain ? ['codigo_roster' => $row['roster_code'] ?? null] : []),
            );
            $this->ids['users'][$row['id']] = $this->insert(
                'usuarios',
                $this->fields(
                    $row,
                    ($this->domain ? '' : 'roster_code ') .
                        'username full_name password_hash active failed_login_attempts locked_until ' .
                        'rut clave_unica_sub auth_provider created_at updated_at',
                ) +
                    ($this->domain ? [] : ['establishment_id' => $tenant]) + [
                        'id_funcionario' => $staff,
                        'id_rol' => $roles[$row['role']],
                    ],
            );
        }
        foreach ($rows('vehicles') as $row) {
            $catalog = VehicleCatalog::ids(
                $this->db,
                $row['vehicle_type'] ?? null,
                $row['model'] ?? null,
                null,
                $this->prefix,
                $this->domain ? $this->id('establishments', $row['establishment_id']) : null,
            );
            $this->ids['vehicles'][$row['id']] = $this->insert(
                'vehiculos',
                $catalog +
                    $this->fields(
                        $row,
                        'license_plate current_odometer_km year active created_at updated_at',
                    ) + [
                        'establishment_id' => $this->id('establishments', $row['establishment_id']),
                        'codigo_movil' => $row['role_code'],
                    ],
            );
        }
        foreach ($rows('cost_centers') as $row) {
            $this->ids['cost_centers'][$row['id']] = $this->insert(
                'centros_costos',
                $this->fields($row, 'code name active created_at updated_at') + [
                    'establishment_id' => $this->id('establishments', $row['establishment_id']),
                ],
            );
        }

        $legs = [];
        foreach ($rows('service_legs') as $leg) {
            $legs[$leg['service_id']][] = $leg;
        }
        foreach ($rows('bitacora_entries') as $row) {
            if (!empty($row['closure_pending'])) {
                throw new \RuntimeException(
                    'Cierre los viajes históricos pendientes antes de importar.',
                );
            }
            $this->tripTenants[$row['id']] = $this->id('establishments', $row['establishment_id']);
            if ($this->domain) {
                $this->copyDomainTrip($row, $legs[$row['id']] ?? []);
            } else {
                $this->copyTrip($row, $legs[$row['id']] ?? []);
            }
        }
        foreach ($rows('service_address_revisions') as $row) {
            $this->insert(
                'revisiones_direccion',
                $this->fields($row, 'revision address source created_at') +
                    ($this->domain
                        ? ['establishment_id' => $this->tripTenants[$row['service_id']]]
                        : []) + [
                        'service_id' => $this->id('bitacora_entries', $row['service_id']),
                        'actor_user_id' => $this->id('users', $row['actor_user_id'] ?? null),
                    ],
            );
        }
        foreach ($rows('sessions') as $row) {
            $this->insert(
                'sesiones',
                $this->fields($row, 'token_hash expires_at revoked_at created_at last_seen_at') + [
                    'user_id' => $this->id('users', $row['user_id']),
                ],
            );
        }
        foreach ($rows('audit_logs') as $row) {
            $type = match ($row['entity_type']) {
                'USER' => 'users',
                'VEHICLE' => 'vehicles',
                'BITACORA' => 'bitacora_entries',
                default => null,
            };
            $oldId = (string) $row['entity_id'];
            $actor = $this->id('users', $row['actor_user_id'] ?? null);
            $entity = $type === null ? null : $this->ids[$type][$oldId] ?? null;
            $this->insert(
                'registros_auditoria',
                $this->fields(
                    $row,
                    'entity_type action before_data after_data ip_address created_at',
                ) +
                    ($this->domain
                        ? ['establishment_id' => $this->auditTenant($type, $entity, $actor)]
                        : []) + [
                        'actor_user_id' => $actor,
                        'entity_id' => $entity ?? 'legacy:' . $oldId,
                    ],
            );
        }
    }

    private function auditTenant(?string $type, ?string $entity, ?string $actor): string
    {
        $tenant = match (true) {
            $entity === null => null,
            $type === 'bitacora_entries' => $this->db
                ->table('viajes')
                ->select('id_establecimiento')
                ->where('id_viaje', $entity)
                ->get()
                ->getRowArray(),
            $type === 'vehicles' => $this->db
                ->table('vehiculos')
                ->select('id_establecimiento')
                ->where('id_vehiculo', $entity)
                ->get()
                ->getRowArray(),
            $type === 'users' => UserAccounts::query($this->db)
                ->where('u.id_usuario', $entity)
                ->get()
                ->getRowArray(),
            default => null,
        };
        $tenant ??=
            $actor === null
                ? null
                : UserAccounts::query($this->db)
                    ->where('u.id_usuario', $actor)
                    ->get()
                    ->getRowArray();
        if (!$tenant) {
            throw new \RuntimeException(
                'Registro de auditoría histórico sin institución identificable.',
            );
        }
        return (string) $tenant['id_establecimiento'];
    }

    private function copyDomainTrip(array $row, array $legs): void
    {
        $tenant = $this->id('establishments', $row['establishment_id']);
        usort($legs, fn($a, $b) => [$a['started_at'], $a['id']] <=> [$b['started_at'], $b['id']]);
        $first = $legs[0] ?? null;
        $last = $legs ? $legs[count($legs) - 1] : null;
        $id = $this->insert('viajes', [
            'establishment_id' => $tenant,
            'cost_center_id' => $this->id('cost_centers', $row['cost_center_id'] ?? null),
            'created_by_user_id' => $this->id('users', $row['created_by_user_id'] ?? null),
            'driver_id' => $this->id('users', $row['driver_id'] ?? null),
            'vehicle_id' => $this->id('vehicles', $row['vehicle_id'] ?? null),
            'actividad' => $row['action_performed'],
            'origin' => 'LEGACY',
            'status' => $row['status'],
            'version' => $row['version'] ?? 0,
            'started_at' => $row['started_at'] ?? null,
            'ended_at' => $row['ended_at'] ?? null,
            'cancelled_at' => $row['cancelled_at'] ?? null,
            'void_reason' => $row['void_reason'] ?? null,
            'departure_odometer_km' => $first['departure_odometer_km'] ?? null,
            'arrival_odometer_km' => $last['arrival_odometer_km'] ?? ($row['odometer_km'] ?? null),
            'created_at' => $row['created_at'] ?? null,
            'updated_at' => $row['updated_at'] ?? null,
        ]);
        $this->ids['bitacora_entries'][$row['id']] = $id;
        $this->insert('viajes_destinos', [
            'establishment_id' => $tenant,
            'id_viaje' => $id,
            'orden' => 1,
            'direccion' => $row['service_address'],
        ]);
        foreach ($legs as $leg) {
            $this->insert('viajes_tramos', [
                'establishment_id' => $tenant,
                'id_viaje' => $id,
                'id_chofer' => $this->id('users', $leg['driver_id']),
                'id_vehiculo' => $this->id('vehicles', $leg['vehicle_id']),
                'fecha_inicio' => $leg['started_at'],
                'fecha_fin' => $leg['ended_at'],
                'odometro_inicio' => $leg['departure_odometer_km'],
                'odometro_fin' => $leg['arrival_odometer_km'],
            ]);
        }
    }

    private function copyTrip(array $row, array $legs): void
    {
        usort(
            $legs,
            fn($a, $b) => [
                $a['started_at'],
                $a['ended_at'] === null,
                $a['ended_at'],
                $a['id'],
            ] <=> [$b['started_at'], $b['ended_at'] === null, $b['ended_at'], $b['id']],
        );
        $shared = [
            'establishment_id' => $this->id('establishments', $row['establishment_id']),
            'cost_center_id' => $this->id('cost_centers', $row['cost_center_id'] ?? null),
            'created_by_user_id' => $this->id('users', $row['created_by_user_id'] ?? null),
            'destino' => $row['service_address'],
            'actividad' => $row['action_performed'],
            'origin' => 'LEGACY',
            'cancelled_at' => $row['cancelled_at'] ?? null,
            'void_reason' => $row['void_reason'] ?? null,
        ];
        $previous = null;
        foreach ($legs ?: [null] as $leg) {
            $status = $row['status'];
            if ($leg !== null && $status !== 'CANCELLED') {
                $status = $leg['ended_at'] === null ? 'IN_PROGRESS' : 'COMPLETED';
            }
            $id = $this->insert(
                'viajes',
                $shared + [
                    'driver_id' => $this->id(
                        'users',
                        $leg['driver_id'] ?? ($row['driver_id'] ?? null),
                    ),
                    'vehicle_id' => $this->id(
                        'vehicles',
                        $leg['vehicle_id'] ?? ($row['vehicle_id'] ?? null),
                    ),
                    'started_at' => $leg === null ? $row['started_at'] ?? null : $leg['started_at'],
                    'ended_at' => $leg === null ? $row['ended_at'] ?? null : $leg['ended_at'],
                    'departure_odometer_km' => $leg['departure_odometer_km'] ?? null,
                    'arrival_odometer_km' =>
                        $leg === null
                            ? $row['odometer_km'] ?? null
                            : $leg['arrival_odometer_km'] ?? null,
                    'id_viaje_anterior' => $previous,
                    'status' => $status,
                    'version' => $row['version'] ?? 0,
                    'created_at' =>
                        $previous === null ? $row['created_at'] ?? null : $leg['started_at'],
                    'updated_at' => $row['updated_at'] ?? null,
                ],
            );
            if ($previous === null) {
                $this->ids['bitacora_entries'][$row['id']] = $id;
            } else {
                $this->insert('revisiones_direccion', [
                    'service_id' => $id,
                    'revision' => 1,
                    'address' => $shared['destino'],
                    'source' => 'LEGACY',
                    'created_at' => $leg['started_at'],
                ]);
            }
            $previous = $id;
        }
    }
}
