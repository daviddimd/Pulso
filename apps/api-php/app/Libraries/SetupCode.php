<?php
namespace App\Libraries;

final class SetupCode
{
    public const FILE = 'pulso-codigo-configuracion.txt';

    public static function path(): string
    {
        return WRITEPATH . self::FILE;
    }

    public static function ensure(): string
    {
        $path = self::path();
        if (is_file($path)) {
            $code = trim((string) file_get_contents($path));
            if ($code !== '') {
                return $code;
            }
        }
        $code = implode('-', str_split(strtoupper(bin2hex(random_bytes(8))), 4));

        $handle = @fopen($path, 'x');
        if ($handle === false) {
            return trim((string) file_get_contents($path));
        }
        fwrite($handle, $code . PHP_EOL);
        fclose($handle);
        @chmod($path, 0600);
        return $code;
    }

    public static function matches(mixed $candidate): bool
    {
        if (!is_string($candidate) || !is_file(self::path())) {
            return false;
        }
        $normalize = fn(string $value) => strtoupper(preg_replace('/[^0-9A-Za-z]/', '', $value));
        $expected = $normalize(trim((string) file_get_contents(self::path())));
        return $expected !== '' && hash_equals($expected, $normalize($candidate));
    }

    public static function clear(): void
    {
        if (is_file(self::path())) {
            @unlink(self::path());
        }
    }
}
