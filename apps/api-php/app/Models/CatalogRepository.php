<?php
namespace App\Models;
use App\Libraries\{UnitOfWork, UserAccounts};
use Config\Database;
final class CatalogRepository
{
    public function driver(string $id, string $establishment): array
    {
        $db = Database::connect();
        if (!UnitOfWork::validId($id)) {
            throw new \DomainException('NOT_FOUND', 404);
        }
        $d = UserAccounts::query($db)
            ->select('e.nombre AS nombre_establecimiento')
            ->join('establecimientos e', 'e.id_establecimiento=f.id_establecimiento')
            ->where('u.id_usuario', $id)
            ->where('f.id_establecimiento', $establishment)
            ->where('r.codigo', 'CHOFER')
            ->get()
            ->getRowArray();
        if (!$d) {
            throw new \DomainException('NOT_FOUND', 404);
        }
        return [
            'id' => (string) $d['id_usuario'],
            'fullName' => $d['nombre_completo'],
            'username' => $d['nombre_usuario'],
            'rosterCode' => $d['codigo_roster'],
            'active' => (bool) $d['activo'],
            'establishmentName' => $d['nombre_establecimiento'],
            'inService' =>
                $db
                    ->table('viajes_tramos')
                    ->where('id_chofer', $id)
                    ->where('id_establecimiento', $establishment)
                    ->where('fecha_fin', null)
                    ->countAllResults() > 0,
        ];
    }
    public function drivers(string $establishment): array
    {
        $db = Database::connect();
        $drivers = UserAccounts::query($db)
            ->where('f.id_establecimiento', $establishment)
            ->where('r.codigo', 'CHOFER')
            ->where('u.activo', 1)
            ->orderBy('u.nombre_completo')
            ->get()
            ->getResultArray();
        $openLegs = [];
        $legs = $db
            ->table('viajes_tramos')
            ->select('id_chofer, id_viaje')
            ->where('id_establecimiento', $establishment)
            ->where('fecha_fin', null)
            ->get()
            ->getResultArray();
        foreach ($legs as $leg) {
            $openLegs[$leg['id_chofer']][] = $leg;
        }
        return array_map(function ($d) use ($openLegs) {
            return [
                'id' => (string) $d['id_usuario'],
                'fullName' => $d['nombre_completo'],
                'rosterCode' => $d['codigo_roster'],
                'serviceLegs' => array_map(
                    fn($l) => ['serviceId' => (string) $l['id_viaje']],
                    $openLegs[$d['id_usuario']] ?? [],
                ),
            ];
        }, $drivers);
    }
    public function costCenters(string $establishment): array
    {
        $rows = Database::connect()
            ->table('centros_costos')
            ->where('id_establecimiento', $establishment)
            ->where('activo', 1)
            ->orderBy('codigo')
            ->get()
            ->getResultArray();
        return array_map(
            fn($c) => [
                'id' => (string) $c['id_centro_costo'],
                'code' => $c['codigo'],
                'name' => $c['nombre'],
                'active' => (bool) $c['activo'],
            ],
            $rows,
        );
    }
}
