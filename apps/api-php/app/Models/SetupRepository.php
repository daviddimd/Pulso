<?php
namespace App\Models;

use App\Libraries\{AuditService, SetupCode};
use Config\Database;
use DomainException;

/** First-run setup: available only while the installation has no establishment. */
final class SetupRepository
{
    public function required(): bool
    {
        return Database::connect()->table('establecimientos')->countAllResults() === 0;
    }

    public function status(): array
    {
        if (!$this->required()) return ['required' => false];
        SetupCode::ensure();
        // The server's list is the one provisioning validates against; browsers also list legacy aliases.
        return ['required' => true, 'codeFile' => 'apps/api-php/writable/' . SetupCode::FILE, 'timezones' => \DateTimeZone::listIdentifiers()];
    }

    public function complete(array $body, string $ip): array
    {
        foreach (['setupCode', 'establishmentCode', 'establishmentName', 'timezone', 'username', 'password'] as $field) {
            if (!is_string($body[$field] ?? null)) throw new DomainException('INVALID_SETUP_DATA', 400);
        }
        $db = Database::connect();
        // A named lock serializes concurrent attempts so only one installation can be claimed.
        if ((int)$db->query('SELECT GET_LOCK(?, 10) AS locked', ['pulso_setup'])->getRowArray()['locked'] !== 1) {
            throw new DomainException('SETUP_BUSY', 409);
        }
        try {
            if (!$this->required()) throw new DomainException('SETUP_COMPLETED', 409);
            if (!SetupCode::matches($body['setupCode'])) throw new DomainException('INVALID_SETUP_CODE', 403);
            $username = trim($body['username']);
            if (!preg_match('/^[A-Za-z0-9._-]{3,50}$/', $username)) throw new DomainException('INVALID_USERNAME', 400);
            $result = (new EstablishmentRepository())->provision(trim($body['establishmentCode']), trim($body['establishmentName']),
                $body['timezone'], $username, $body['password']);
            AuditService::log($result['establishmentId'], $result['adminId'], 'ESTABLECIMIENTO', $result['establishmentId'], 'CONFIGURACION_INICIAL',
                null, ['code' => trim($body['establishmentCode']), 'adminUsername' => $username], $ip);
            SetupCode::clear();
            return $result + ['username' => $username];
        } finally {
            $db->query('SELECT RELEASE_LOCK(?)', ['pulso_setup']);
        }
    }
}
