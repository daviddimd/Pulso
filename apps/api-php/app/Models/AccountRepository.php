<?php
namespace App\Models;

use App\Libraries\{AuditService, SecurityLib, UnitOfWork, UserAccounts};
use Config\Database;
use DomainException;

/** Driver and administration accounts of the administrator's own institution. */
final class AccountRepository
{
    private const ROLES = ['ADMIN', 'DRIVER'];

    public function __construct(private array $actor) {}

    public function listing(): array
    {
        $rows = UserAccounts::query(Database::connect())->where('f.establishment_id', $this->actor['establishmentId'])
            ->whereIn('r.codigo', self::ROLES)->where('u.username NOT LIKE', 'archived-%')
            ->orderBy('u.active', 'DESC')->orderBy('r.codigo')->orderBy('u.full_name')->get()->getResultArray();
        return array_map($this->dto(...), $rows);
    }

    public function create(array $body): array
    {
        $fullName = $this->field($body['fullName'] ?? null, 120, 2);
        $username = is_string($body['username'] ?? null) ? trim($body['username']) : '';
        if (!preg_match('/^[A-Za-z0-9._-]{3,50}$/', $username)) throw new DomainException('INVALID_USERNAME', 400);
        $role = $body['role'] ?? null;
        if (!in_array($role, self::ROLES, true)) throw new DomainException('INVALID_ACCOUNT_DATA', 400);
        $roster = isset($body['rosterCode']) && trim((string)$body['rosterCode']) !== '' ? $this->field($body['rosterCode'], 30) : null;
        $password = $body['password'] ?? null;
        if (!is_string($password) || mb_strlen($password) < 12 || strlen($password) > 1024) throw new DomainException('PASSWORD_TOO_SHORT', 400);

        return UnitOfWork::run($this->actor, function () use ($fullName, $username, $role, $roster, $password) {
            $db = Database::connect();
            if ($db->table('usuarios')->where('username', $username)->countAllResults()) throw new DomainException('USERNAME_EXISTS', 409);
            if ($roster !== null && $db->table('funcionarios')->where('establishment_id', $this->actor['establishmentId'])->where('codigo_roster', $roster)->countAllResults()) {
                throw new DomainException('ROSTER_CODE_EXISTS', 409);
            }
            $now = UnitOfWork::now();
            $id = UserAccounts::create($db, ['establishment_id' => $this->actor['establishmentId'], 'username' => $username, 'full_name' => $fullName,
                'roster_code' => $roster, 'password_hash' => SecurityLib::hashPassword($password), 'active' => 1, 'failed_login_attempts' => 0,
                'auth_provider' => 'local', 'created_at' => $now, 'updated_at' => $now], $role);
            // The audit keeps identity data only; the password hash is never logged.
            AuditService::log($this->actor['establishmentId'], $this->actor['id'], 'USER', $id, 'CREATE', null,
                ['username' => $username, 'fullName' => $fullName, 'role' => $role, 'rosterCode' => $roster]);
            return $this->dto(UserAccounts::query($db)->where('u.id_usuario', $id)->get()->getRowArray());
        });
    }

    private function field(mixed $value, int $max, int $min = 1): string
    {
        try { return UnitOfWork::text($value, $max, $min); }
        catch (DomainException) { throw new DomainException('INVALID_ACCOUNT_DATA', 400); }
    }

    private function dto(array $u): array
    {
        return ['id' => (string)$u['id_usuario'], 'fullName' => $u['full_name'], 'username' => $u['username'], 'role' => $u['role'],
            'rosterCode' => $u['roster_code'], 'active' => (bool)$u['active']];
    }
}
