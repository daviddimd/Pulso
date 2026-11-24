<?php

namespace App\Database\Seeds;

use App\Libraries\{SecurityLib, UserAccounts, VehicleCatalog};
use CodeIgniter\Database\Seeder;

class PulsoSeeder extends Seeder
{
    public function run()
    {
        if (ENVIRONMENT === 'production') {
            throw new \RuntimeException('La semilla de prototipo no se ejecuta en producción.');
        }
        $db = $this->db;
        $now = date('Y-m-d H:i:s');

        $estExists = $db->table('establecimientos')->where('codigo', 'HRT')->get()->getRow();
        if (!$estExists) {
            $db->table('establecimientos')->insert([
                'codigo' => 'HRT',
                'nombre' => 'Hospital Regional de Talca',
                'zona_horaria' => 'America/Santiago',
                'activo' => 1,
                'fecha_creacion' => $now,
                'fecha_actualizacion' => $now,
            ]);
        }

        $estId = $estExists ? (string) $estExists->id_establecimiento : (string) $db->insertID();

        $adminExists = $db->table('usuarios')->where('nombre_usuario', 'admin')->get()->getRow();
        if (!$adminExists) {
            UserAccounts::create(
                $db,
                [
                    'id_establecimiento' => $estId,
                    'nombre_usuario' => 'admin',
                    'nombre_completo' => 'Administrador Movilización',
                    'hash_contrasena' => SecurityLib::hashPassword('admin'),
                    'activo' => 1,
                    'intentos_fallidos' => 0,
                    'proveedor_autenticacion' => 'local',
                    'fecha_creacion' => $now,
                    'fecha_actualizacion' => $now,
                ],
                'ADMIN',
            );
        }

        $drivers = [
            [
                'rosterCode' => 'MOV2026-01',
                'username' => 'chofer01',
                'fullName' => 'Miguel Ángel Pacheco Alfaro',
            ],
            [
                'rosterCode' => 'MOV2026-02',
                'username' => 'chofer02',
                'fullName' => 'Carlos José Canales Sepulveda',
            ],
            [
                'rosterCode' => 'MOV2026-03',
                'username' => 'chofer03',
                'fullName' => 'Belisario Alexis Gutierrez Gonzalez',
            ],
            [
                'rosterCode' => 'MOV2026-04',
                'username' => 'chofer04',
                'fullName' => 'Oscar Valdivia Mejias',
            ],
            [
                'rosterCode' => 'MOV2026-05',
                'username' => 'chofer05',
                'fullName' => 'Luis Alfonso Cerda Arevalo',
            ],
            [
                'rosterCode' => 'MOV2026-06',
                'username' => 'chofer06',
                'fullName' => 'Cesar Martinez Espinoza',
            ],
            [
                'rosterCode' => 'MOV2026-07',
                'username' => 'chofer07',
                'fullName' => 'Hector Felipe Gonzalez Ruiz',
            ],
            [
                'rosterCode' => 'MOV2026-08',
                'username' => 'chofer08',
                'fullName' => 'Juan Ricardo Gonzalez Veliz',
            ],
            [
                'rosterCode' => 'MOV2026-09',
                'username' => 'chofer09',
                'fullName' => 'Cristian Enrique Castro Salazar',
            ],
        ];

        $driverPasswordHash = SecurityLib::hashPassword('chofer');

        foreach ($drivers as $d) {
            $exists = $db
                ->table('usuarios')
                ->where('nombre_usuario', $d['username'])
                ->get()
                ->getRow();
            if (!$exists) {
                UserAccounts::create(
                    $db,
                    [
                        'id_establecimiento' => $estId,
                        'nombre_usuario' => $d['username'],
                        'codigo_roster' => $d['rosterCode'],
                        'nombre_completo' => $d['fullName'],
                        'hash_contrasena' => $driverPasswordHash,
                        'activo' => 1,
                        'intentos_fallidos' => 0,
                        'proveedor_autenticacion' => 'local',
                        'fecha_creacion' => $now,
                        'fecha_actualizacion' => $now,
                    ],
                    'DRIVER',
                );
            }
        }

        $vehicles = [
            [
                'roleCode' => '7-513',
                'licensePlate' => 'DPKD.53-5',
                'vehicleType' => 'CAMIÓN',
                'year' => 2012,
                'model' => 'CANTER 7.5',
                'currentOdometerKm' => 145200,
            ],
            [
                'roleCode' => '7-454',
                'licensePlate' => 'KW-5091-4',
                'vehicleType' => 'CAMIONETA',
                'year' => 2007,
                'model' => 'TERRANO PICK UP 2.5',
                'currentOdometerKm' => 210450,
            ],
            [
                'roleCode' => '7-489',
                'licensePlate' => 'CJFJ.23-5',
                'vehicleType' => 'CAMIONETA',
                'year' => 2010,
                'model' => 'D-MAX TH CC 3.0D HR WT',
                'currentOdometerKm' => 189300,
            ],
            [
                'roleCode' => '7-490',
                'licensePlate' => 'CRBX.38-4',
                'vehicleType' => 'MINIBUS',
                'year' => 2010,
                'model' => 'NEW H-1 MB GLS 2.5',
                'currentOdometerKm' => 176500,
            ],
            [
                'roleCode' => '7-491',
                'licensePlate' => 'CRBX.46-5',
                'vehicleType' => 'MINIBUS',
                'year' => 2010,
                'model' => 'NEW H-1 MB GLS 2.5',
                'currentOdometerKm' => 164200,
            ],
            [
                'roleCode' => '7-533',
                'licensePlate' => 'GZPF-26-9',
                'vehicleType' => 'FURGON',
                'year' => 2015,
                'model' => 'NEW H1',
                'currentOdometerKm' => 98400,
            ],
            [
                'roleCode' => '7-540',
                'licensePlate' => 'GVXV-88-5',
                'vehicleType' => 'CAMIONETA',
                'year' => 2015,
                'model' => 'D-MAX 2.5',
                'currentOdometerKm' => 112100,
            ],
            [
                'roleCode' => '7-541',
                'licensePlate' => 'GVXV-89-3',
                'vehicleType' => 'CAMIONETA',
                'year' => 2015,
                'model' => 'D-MAX 2.5',
                'currentOdometerKm' => 105600,
            ],
        ];

        foreach ($vehicles as $v) {
            $exists = $db
                ->table('vehiculos')
                ->where('id_establecimiento', $estId)
                ->where('codigo_movil', $v['roleCode'])
                ->get()
                ->getRow();
            if (!$exists) {
                $db->table('vehiculos')->insert(
                    [
                        'id_establecimiento' => $estId,
                        'codigo_movil' => $v['roleCode'],
                        'patente' => $v['licensePlate'],
                        'anio' => $v['year'],
                        'odometro_actual' => $v['currentOdometerKm'],
                        'activo' => 1,
                        'fecha_creacion' => $now,
                        'fecha_actualizacion' => $now,
                    ] +
                        VehicleCatalog::ids(
                            $db,
                            $v['vehicleType'],
                            $v['model'],
                            null,
                            '',
                            (string) $estId,
                        ),
                );
            }
        }

        $costCenters = json_decode(
            file_get_contents(__DIR__ . '/cost-centers.json'),
            true,
            512,
            JSON_THROW_ON_ERROR,
        );

        foreach ($costCenters as $cc) {
            $exists = $db
                ->table('centros_costos')
                ->where('id_establecimiento', $estId)
                ->where('codigo', $cc['code'])
                ->get()
                ->getRow();

            if (!$exists) {
                $db->table('centros_costos')->insert([
                    'id_establecimiento' => $estId,
                    'codigo' => $cc['code'],
                    'nombre' => $cc['name'],
                    'activo' => 1,
                    'fecha_creacion' => $now,
                    'fecha_actualizacion' => $now,
                ]);
            }
        }
    }
}
