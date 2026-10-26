<?php

declare(strict_types=1);

namespace App\Libraries;

class SecurityLib
{
    /**
     * Hash a password using Argon2id.
     */
    public static function hashPassword(string $password): string
    {
        return password_hash($password, PASSWORD_ARGON2ID);
    }

    /**
     * Verify a password against a hash.
     */
    public static function verifyPassword(string $password, string $hash): bool
    {
        // Node's PHC serializer orders the Argon2 parameters m,p,t. PHP's
        // native parser requires m,t,p. Reordering metadata preserves the hash.
        if (preg_match('/^(\$argon2(?:id|i)\$v=19\$)([^$]+)(\$[^$]+\$[^$]+)$/D', $hash, $matches)) {
            $params = [];
            foreach (explode(',', $matches[2]) as $pair) {
                if (!preg_match('/^([mtp])=(\d+)$/D', $pair, $part) || isset($params[$part[1]])) return false;
                $params[$part[1]] = $part[2];
            }
            if (count($params) !== 3) return false;
            $hash = $matches[1] . 'm=' . $params['m'] . ',t=' . $params['t'] . ',p=' . $params['p'] . $matches[3];
        }
        return password_verify($password, $hash);
    }

    /**
     * Generate a cryptographically secure 32-byte session token (hex encoded).
     */
    public static function generateSessionToken(): string
    {
        return bin2hex(random_bytes(32));
    }

    /**
     * Hash a token using SHA-256 for database storage.
     */
    public static function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }

    /**
     * Generate an RFC 4122 v4 UUID.
     */
    public static function generateUuid(): string
    {
        $data = random_bytes(16);

        // Set version to 0100
        $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
        // Set bits 6-7 to 10
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
