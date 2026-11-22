<?php
namespace App\Commands;

use App\Libraries\UserAccounts;
use CodeIgniter\CLI\{BaseCommand, CLI};
use Config\Database;

final class ResetPassword extends BaseCommand
{
    protected $group = 'Pulso';
    protected $name = 'pulso:clave';
    protected $description = 'Restablece la contraseña de una cuenta, la desbloquea y cierra sus sesiones.';
    protected $usage = 'pulso:clave <usuario>   (contraseña nueva en PULSO_NEW_PASSWORD)';

    public function run(array $params)
    {
        if (count($params) !== 1) { CLI::error($this->usage); return EXIT_ERROR; }
        // An environment variable keeps the password out of the command history.
        $password = getenv('PULSO_NEW_PASSWORD') ?: '';
        try {
            $user = UserAccounts::resetPassword(Database::connect(), $params[0], $password);
            CLI::write("Contraseña restablecida para {$user['username']} ({$user['role']}). Sus sesiones abiertas se cerraron.", 'green');
            if (!$user['active']) CLI::write('La cuenta está desactivada; no podrá ingresar hasta reactivarla.', 'yellow');
            return EXIT_SUCCESS;
        } catch (\DomainException $e) {
            CLI::error(match ($e->getMessage()) {
                'PASSWORD_TOO_SHORT' => 'Define PULSO_NEW_PASSWORD con al menos 12 caracteres.',
                'USER_NOT_FOUND' => 'No existe una cuenta con ese usuario.',
                default => 'No se pudo restablecer la contraseña.',
            });
            return EXIT_ERROR;
        } finally {
            putenv('PULSO_NEW_PASSWORD');
        }
    }
}
