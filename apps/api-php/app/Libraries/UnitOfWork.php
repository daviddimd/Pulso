<?php
namespace App\Libraries;

use Config\Database;
use DomainException;

/** Transaction boundary shared by all mutations in an establishment. */
final class UnitOfWork
{
    public static function run(array $actor, callable $work): mixed
    {
        $db = Database::connect();
        $db->transException(true)->transBegin();
        try {
            $tenant = $db->query('SELECT id FROM establishments WHERE id = ? AND active = 1 FOR UPDATE', [$actor['establishmentId']])->getRowArray();
            if (!$tenant) throw new DomainException('FORBIDDEN', 403);
            $result = $work($db);
            if (!$db->transStatus()) throw new \RuntimeException('Transaction failed');
            $db->transCommit();
            return $result;
        } catch (\Throwable $e) {
            $db->transRollback();
            throw $e;
        }
    }
    public static function now(): string { return (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))->format('Y-m-d H:i:s.v'); }
    public static function iso(?string $date): ?string { return $date ? (new \DateTimeImmutable($date, new \DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z') : null; }
    public static function text(mixed $value, int $max, int $min = 1): string {
        if (!is_string($value)) throw new DomainException('INVALID_SERVICE_DATA', 400);
        $value = trim($value);
        if (mb_strlen($value) < $min || mb_strlen($value) > $max) throw new DomainException('INVALID_SERVICE_DATA', 400);
        return $value;
    }
    public static function km(mixed $value): int {
        if (!is_int($value) || $value < 0 || $value > 10000000) throw new DomainException('INVALID_SERVICE_DATA', 400);
        return $value;
    }
    public static function id(mixed $value): ?string {
        if ($value === null) return null;
        if (!is_string($value) || $value === '' || strlen($value) > 36) throw new DomainException('INVALID_SERVICE_DATA', 400);
        return $value;
    }
}
