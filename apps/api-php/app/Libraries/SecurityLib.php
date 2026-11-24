<?php

declare(strict_types=1);

namespace App\Libraries;

class SecurityLib
{
    public static function hashPassword(string $password): string
    {
        return password_hash($password, PASSWORD_ARGON2ID);
    }

    public static function verifyPassword(string $password, string $hash): bool
    {
        if (preg_match('/^(\$argon2(?:id|i)\$v=19\$)([^$]+)(\$[^$]+\$[^$]+)$/D', $hash, $matches)) {
            $params = [];
            foreach (explode(',', $matches[2]) as $pair) {
                if (!preg_match('/^([mtp])=(\d+)$/D', $pair, $part) || isset($params[$part[1]])) {
                    return false;
                }
                $params[$part[1]] = $part[2];
            }
            if (count($params) !== 3) {
                return false;
            }
            $hash = sprintf(
                '%sm=%s,t=%s,p=%s%s',
                $matches[1],
                $params['m'],
                $params['t'],
                $params['p'],
                $matches[3],
            );
        }
        return password_verify($password, $hash);
    }

    public static function generateSessionToken(): string
    {
        return bin2hex(random_bytes(32));
    }

    public static function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }
}
