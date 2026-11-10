<?php

namespace App\Database\Seeds;

use App\Libraries\{SecurityLib, UserAccounts, VehicleCatalog};
use CodeIgniter\Database\Seeder;

class PulsoSeeder extends Seeder
{
    public function run()
    {
        if (ENVIRONMENT === 'production') throw new \RuntimeException('La semilla de prototipo no se ejecuta en producción.');
        $db = $this->db;
        $now = date('Y-m-d H:i:s');

        // 1. Establishments: Hospital Regional de Talca
        $estExists = $db->table('establecimientos')->where('code', 'HRT')->get()->getRow();
        if (!$estExists) {
            $db->table('establecimientos')->insert([
                'code'       => 'HRT',
                'name'       => 'Hospital Regional de Talca',
                'timezone'   => 'America/Santiago',
                'active'     => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $estId = $estExists ? (string)$estExists->id_establecimiento : (string)$db->insertID();

        // 2. Administrator account (admin / admin)
        $adminExists = $db->table('usuarios')->where('username', 'admin')->get()->getRow();
        if (!$adminExists) {
            UserAccounts::create($db, [
                'establishment_id'      => $estId,
                'username'              => 'admin',
                'full_name'             => 'Administrador Movilización',
                'password_hash'         => SecurityLib::hashPassword('admin'),
                'active'                => 1,
                'failed_login_attempts' => 0,
                'auth_provider'         => 'local',
                'created_at'            => $now,
                'updated_at'            => $now,
            ], 'ADMIN');
        }

        // 3. Official Drivers (MOV2026-01 to MOV2026-09) with password 'chofer'
        $drivers = [
            ['rosterCode' => 'MOV2026-01', 'username' => 'chofer01', 'fullName' => 'Miguel Ángel Pacheco Alfaro'],
            ['rosterCode' => 'MOV2026-02', 'username' => 'chofer02', 'fullName' => 'Carlos José Canales Sepulveda'],
            ['rosterCode' => 'MOV2026-03', 'username' => 'chofer03', 'fullName' => 'Belisario Alexis Gutierrez Gonzalez'],
            ['rosterCode' => 'MOV2026-04', 'username' => 'chofer04', 'fullName' => 'Oscar Valdivia Mejias'],
            ['rosterCode' => 'MOV2026-05', 'username' => 'chofer05', 'fullName' => 'Luis Alfonso Cerda Arevalo'],
            ['rosterCode' => 'MOV2026-06', 'username' => 'chofer06', 'fullName' => 'Cesar Martinez Espinoza'],
            ['rosterCode' => 'MOV2026-07', 'username' => 'chofer07', 'fullName' => 'Hector Felipe Gonzalez Ruiz'],
            ['rosterCode' => 'MOV2026-08', 'username' => 'chofer08', 'fullName' => 'Juan Ricardo Gonzalez Veliz'],
            ['rosterCode' => 'MOV2026-09', 'username' => 'chofer09', 'fullName' => 'Cristian Enrique Castro Salazar'],
        ];

        $driverPasswordHash = SecurityLib::hashPassword('chofer');

        foreach ($drivers as $d) {
            $exists = $db->table('usuarios')->where('username', $d['username'])->get()->getRow();
            if (!$exists) {
                UserAccounts::create($db, [
                    'establishment_id'      => $estId,
                    'username'              => $d['username'],
                    'roster_code'           => $d['rosterCode'],
                    'full_name'             => $d['fullName'],
                    'password_hash'         => $driverPasswordHash,
                    'active'                => 1,
                    'failed_login_attempts' => 0,
                    'auth_provider'         => 'local',
                    'created_at'            => $now,
                    'updated_at'            => $now,
                ], 'DRIVER');
            }
        }

        // 4. Official Vehicles (8 active hospital units)
        $vehicles = [
            ['roleCode' => '7-513', 'licensePlate' => 'DPKD.53-5', 'vehicleType' => 'CAMIÓN', 'year' => 2012, 'model' => 'CANTER 7.5', 'currentOdometerKm' => 145200],
            ['roleCode' => '7-454', 'licensePlate' => 'KW-5091-4', 'vehicleType' => 'CAMIONETA', 'year' => 2007, 'model' => 'TERRANO PICK UP 2.5', 'currentOdometerKm' => 210450],
            ['roleCode' => '7-489', 'licensePlate' => 'CJFJ.23-5', 'vehicleType' => 'CAMIONETA', 'year' => 2010, 'model' => 'D-MAX TH CC 3.0D HR WT', 'currentOdometerKm' => 189300],
            ['roleCode' => '7-490', 'licensePlate' => 'CRBX.38-4', 'vehicleType' => 'MINIBUS', 'year' => 2010, 'model' => 'NEW H-1 MB GLS 2.5', 'currentOdometerKm' => 176500],
            ['roleCode' => '7-491', 'licensePlate' => 'CRBX.46-5', 'vehicleType' => 'MINIBUS', 'year' => 2010, 'model' => 'NEW H-1 MB GLS 2.5', 'currentOdometerKm' => 164200],
            ['roleCode' => '7-533', 'licensePlate' => 'GZPF-26-9', 'vehicleType' => 'FURGON', 'year' => 2015, 'model' => 'NEW H1', 'currentOdometerKm' => 98400],
            ['roleCode' => '7-540', 'licensePlate' => 'GVXV-88-5', 'vehicleType' => 'CAMIONETA', 'year' => 2015, 'model' => 'D-MAX 2.5', 'currentOdometerKm' => 112100],
            ['roleCode' => '7-541', 'licensePlate' => 'GVXV-89-3', 'vehicleType' => 'CAMIONETA', 'year' => 2015, 'model' => 'D-MAX 2.5', 'currentOdometerKm' => 105600],
        ];

        foreach ($vehicles as $v) {
            $exists = $db->table('vehiculos')->where('establishment_id', $estId)->where('codigo_movil', $v['roleCode'])->get()->getRow();
            if (!$exists) {
                $db->table('vehiculos')->insert([
                    'establishment_id'    => $estId,
                    'codigo_movil'           => $v['roleCode'],
                    'license_plate'       => $v['licensePlate'],
                    'year'                => $v['year'],
                    'current_odometer_km' => $v['currentOdometerKm'],
                    'active'              => 1,
                    'created_at'          => $now,
                    'updated_at'          => $now,
                ] + VehicleCatalog::ids($db, $v['vehicleType'], $v['model']));
            }
        }

        // 5. Institutional Cost Centers (SIGCOM Catalog)
        $costCenters = json_decode(file_get_contents(__DIR__ . '/cost-centers.json'), true, 512, JSON_THROW_ON_ERROR);

        foreach ($costCenters as $cc) {
            $exists = $db->table('centros_costos')
                ->where('establishment_id', $estId)
                ->where('code', $cc['code'])
                ->get()
                ->getRow();

            if (!$exists) {
                $db->table('centros_costos')->insert([
                    'establishment_id' => $estId,
                    'code'             => $cc['code'],
                    'name'             => $cc['name'],
                    'active'           => 1,
                    'created_at'       => $now,
                    'updated_at'       => $now,
                ]);
            }
        }
    }
}
