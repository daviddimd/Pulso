<?php
namespace App\Models;
use App\Libraries\{Codes, SecurityLib, AuditService, UnitOfWork, UserAccounts};
use Config\Database;
use DomainException;

final class AuthRepository
{
    private const ACCESS_ROLES = ['ADMINISTRACION', 'CHOFER'];

    public function sessionUser(mixed $token): ?array
    {
        if (!is_string($token) || $token === '') {
            return null;
        }
        $row = UserAccounts::query(Database::connect())
            ->select(
                'e.nombre AS nombre_establecimiento, e.zona_horaria AS zona_horaria_establecimiento',
            )
            ->join('sesiones s', 's.id_usuario=u.id_usuario')
            ->join('establecimientos e', 'e.id_establecimiento=f.id_establecimiento')
            ->whereIn('r.codigo', self::ACCESS_ROLES)
            ->where('s.hash_token', SecurityLib::hashToken($token))
            ->where('s.fecha_expiracion >', gmdate('Y-m-d H:i:s'))
            ->where('s.fecha_revocacion', null)
            ->where('u.activo', 1)
            ->where('e.activo', 1)
            ->get()
            ->getRowArray();
        return $row
            ? $this->payload($row, [
                'id_establecimiento' => $row['id_establecimiento'],
                'nombre' => $row['nombre_establecimiento'],
                'zona_horaria' => $row['zona_horaria_establecimiento'],
            ])
            : null;
    }
    private function lockedUser($db, string $column, string $value): ?array
    {
        $sql = UserAccounts::query($db)
            ->where('u.' . $column, $value)
            ->getCompiledSelect();
        return $db->query($sql . ' FOR UPDATE')->getRowArray();
    }

    private function canSignIn(array $u, ?array $e): bool
    {
        return $u['activo'] && $e && in_array($u['role'], self::ACCESS_ROLES, true);
    }
    public function login(string $username, string $password, string $ip): array
    {
        return UnitOfWork::transaction(function ($db) use ($username, $password, $ip) {
            $u = $this->lockedUser($db, 'nombre_usuario', $username);
            if (!$u) {
                return ['error' => 'INVALID_CREDENTIALS', 'status' => 401];
            }
            $e = $this->establishment($u['id_establecimiento']);
            if (!$this->canSignIn($u, $e)) {
                return ['error' => 'ACCOUNT_DISABLED', 'status' => 403];
            }
            if ($u['bloqueado_hasta'] && $u['bloqueado_hasta'] > gmdate('Y-m-d H:i:s')) {
                return ['error' => 'ACCOUNT_LOCKED', 'status' => 423];
            }
            if (!SecurityLib::verifyPassword($password, $u['hash_contrasena'])) {
                $attempts = (int) $u['intentos_fallidos'] + 1;
                $changes = ['intentos_fallidos' => $attempts];
                if ($attempts >= 5) {
                    $changes = [
                        'intentos_fallidos' => 0,
                        'bloqueado_hasta' => gmdate('Y-m-d H:i:s', time() + 900),
                    ];
                }
                $db->table('usuarios')
                    ->where('id_usuario', (string) $u['id_usuario'])
                    ->update($changes);
                AuditService::log(
                    (string) $u['id_establecimiento'],
                    (string) $u['id_usuario'],
                    'USUARIO',
                    (string) $u['id_usuario'],
                    'INGRESO_FALLIDO',
                    null,
                    ['failedAttempts' => $attempts],
                    $ip,
                );
                return ['error' => 'INVALID_CREDENTIALS', 'status' => 401];
            }
            $db->table('usuarios')
                ->where('id_usuario', (string) $u['id_usuario'])
                ->update(['intentos_fallidos' => 0, 'bloqueado_hasta' => null]);
            return $this->session($u, $e, $ip);
        });
    }
    public function establishment(string $id): ?array
    {
        return Database::connect()
            ->table('establecimientos')
            ->where('id_establecimiento', $id)
            ->where('activo', 1)
            ->get()
            ->getRowArray();
    }
    private function payload(array $u, array $e): array
    {
        return [
            'id' => (string) $u['id_usuario'],
            'username' => $u['nombre_usuario'],
            'fullName' => $u['nombre_completo'],
            'role' => Codes::api(Codes::ROLE, $u['role']),
            'rosterCode' => $u['codigo_roster'],
            'establishmentId' => (string) $e['id_establecimiento'],
            'establishmentName' => $e['nombre'],
            'establishmentTimezone' => $e['zona_horaria'],
        ];
    }
    public function current(string $id): ?array
    {
        $u = UserAccounts::query(Database::connect())
            ->where('u.id_usuario', $id)
            ->where('u.activo', 1)
            ->whereIn('r.codigo', self::ACCESS_ROLES)
            ->get()
            ->getRowArray();
        $e = $u ? $this->establishment($u['id_establecimiento']) : null;
        return $u && $e ? $this->payload($u, $e) : null;
    }
    private function session(array $u, array $e, string $ip): array
    {
        $token = SecurityLib::generateSessionToken();
        $ttl = max(1, min(24, (int) (getenv('PULSO_SESSION_TTL_HOURS') ?: 12))) * 3600;
        $db = Database::connect();
        $db->table('sesiones')->insert([
            'id_usuario' => (string) $u['id_usuario'],
            'hash_token' => SecurityLib::hashToken($token),
            'fecha_expiracion' => gmdate('Y-m-d H:i:s', time() + $ttl),
            'fecha_creacion' => UnitOfWork::now(),
            'fecha_ultimo_uso' => UnitOfWork::now(),
        ]);
        AuditService::log(
            (string) $u['id_establecimiento'],
            (string) $u['id_usuario'],
            'USUARIO',
            (string) $u['id_usuario'],
            'INGRESO',
            null,
            ['sessionId' => (string) $db->insertID()],
            $ip,
        );
        return ['token' => $token, 'ttl' => $ttl, 'user' => $this->payload($u, $e)];
    }
    public function claveUnica(array $identity, string $ip): array
    {
        $number = $identity['RolUnico']['numero'] ?? null;
        $dv = $identity['RolUnico']['DV'] ?? null;
        $sub = $identity['sub'] ?? null;
        if (
            (!is_int($number) && !is_string($number)) ||
            !is_string($dv) ||
            !is_string($sub) ||
            $sub === '' ||
            strlen($sub) > 100
        ) {
            throw new DomainException('OAUTH_USER_ERROR', 400);
        }
        $rut = $number . '-' . strtoupper($dv);
        if (!preg_match('/^\d{1,8}-[0-9K]$/', $rut)) {
            throw new DomainException('OAUTH_USER_ERROR', 400);
        }
        return UnitOfWork::transaction(function ($db) use ($rut, $sub, $ip) {
            $u = $this->lockedUser($db, 'rut', $rut);
            if (!$u || ($u['sub_clave_unica'] && !hash_equals($u['sub_clave_unica'], $sub))) {
                throw new DomainException('USER_NOT_REGISTERED', 403);
            }
            $e = $this->establishment($u['id_establecimiento']);
            if (!$this->canSignIn($u, $e)) {
                throw new DomainException('ACCOUNT_DISABLED', 403);
            }
            $db->table('usuarios')
                ->where('id_usuario', (string) $u['id_usuario'])
                ->update([
                    'sub_clave_unica' => $sub,
                    'intentos_fallidos' => 0,
                    'bloqueado_hasta' => null,
                ]);
            return $this->session($u, $e, $ip);
        });
    }
    public function logout(string $token, ?string $userId, string $ip): void
    {
        Database::connect()
            ->table('sesiones')
            ->where('hash_token', SecurityLib::hashToken($token))
            ->update(['fecha_revocacion' => UnitOfWork::now()]);
        if (!$userId) {
            return;
        }
        $u = UserAccounts::query(Database::connect())
            ->where('u.id_usuario', $userId)
            ->get()
            ->getRowArray();
        if ($u) {
            AuditService::log(
                (string) $u['id_establecimiento'],
                $userId,
                'USUARIO',
                $userId,
                'SALIDA',
                null,
                null,
                $ip,
            );
        }
    }
}
