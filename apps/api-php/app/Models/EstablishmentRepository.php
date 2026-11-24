<?php
namespace App\Models;
use App\Libraries\{UnitOfWork, UserAccounts};
use Config\Database;
use DomainException;

final class EstablishmentRepository
{
    public function provision(
        string $code,
        string $name,
        string $timezone,
        string $username,
        string $password,
    ): array {
        $code = UnitOfWork::text($code, 30);
        $name = UnitOfWork::text($name, 200);
        $username = UnitOfWork::text($username, 50);
        if (
            !preg_match('/^[A-Za-z0-9_-]+$/', $code) ||
            !in_array($timezone, \DateTimeZone::listIdentifiers(), true)
        ) {
            throw new DomainException('INVALID_ESTABLISHMENT', 400);
        }
        if (mb_strlen($password) < 12 || strlen($password) > 1024) {
            throw new DomainException('ADMIN_PASSWORD_TOO_SHORT', 400);
        }
        $db = Database::connect();
        $db->transException(true)->transBegin();
        try {
            if (
                $db->table('establecimientos')->where('codigo', $code)->countAllResults() ||
                $db->table('usuarios')->where('nombre_usuario', $username)->countAllResults()
            ) {
                throw new DomainException('ESTABLISHMENT_OR_USERNAME_EXISTS', 409);
            }
            $now = UnitOfWork::now();
            $db->table('establecimientos')->insert([
                'codigo' => $code,
                'nombre' => $name,
                'zona_horaria' => $timezone,
                'activo' => 1,
                'fecha_creacion' => $now,
                'fecha_actualizacion' => $now,
            ]);
            $id = (string) $db->insertID();
            $admin = UserAccounts::create(
                $db,
                [
                    'id_establecimiento' => $id,
                    'nombre_usuario' => $username,
                    'nombre_completo' => mb_substr('Administración · ' . $name, 0, 120),
                    'hash_contrasena' => password_hash($password, PASSWORD_ARGON2ID),
                    'activo' => 1,
                    'fecha_creacion' => $now,
                    'fecha_actualizacion' => $now,
                ],
                'ADMIN',
            );
            if (!$db->transStatus()) {
                throw new \RuntimeException('Provisioning failed');
            }
            $db->transCommit();
            return ['establishmentId' => $id, 'adminId' => $admin];
        } catch (\Throwable $e) {
            $db->transRollback();
            throw $e;
        }
    }
}
