<?php
namespace App\Commands;

use App\Libraries\{SetupCode, UserAccounts};
use App\Models\{AuthRepository, SetupRepository};
use CodeIgniter\CLI\BaseCommand;
use Config\Database;

final class TestSetup extends BaseCommand
{
    protected $group = 'Tests';
    protected $name = 'pulso:prueba-configuracion';
    protected $description = 'Verifica la configuración inicial sobre una pulso_test vacía.';

    public function run(array $params)
    {
        $db = Database::connect();
        if (ENVIRONMENT === 'production' || env('PULSO_INTEGRATION') !== '1' || $db->database !== 'pulso_test') throw new \RuntimeException('Base no autorizada.');
        $check = function ($condition, $message) { if (!$condition) throw new \RuntimeException($message); };
        $rejects = function (callable $work, string $code, string $message) use ($check) {
            try { $work(); } catch (\DomainException $e) { $check($e->getMessage() === $code, $message . ' (' . $e->getMessage() . ')'); return; }
            throw new \RuntimeException($message);
        };
        $db->query('SET FOREIGN_KEY_CHECKS=0');
        foreach (['sesiones','registros_auditoria','revisiones_direccion','folios_viajes_anteriores','viajes_tramos','viajes','vehiculos','centros_costos','usuarios','funcionarios','tipos_vehiculo','modelos_vehiculo','marcas_vehiculo','establecimientos'] as $table) $db->table($table)->emptyTable();
        $db->query('SET FOREIGN_KEY_CHECKS=1');
        SetupCode::clear();

        $setup = new SetupRepository();
        $status = $setup->status();
        $check($status['required'] === true && is_file(SetupCode::path()), 'Una instalación vacía debe pedir configuración y generar el código.');
        $code = trim(file_get_contents(SetupCode::path()));
        $check(SetupCode::ensure() === $code, 'El código debe mantenerse mientras no se use.');
        $body = ['setupCode' => strtolower($code), 'establishmentCode' => 'NUEVO', 'establishmentName' => 'Hospital Nuevo',
            'timezone' => 'America/Santiago', 'username' => 'admin.nuevo', 'password' => 'una-clave-larga-segura'];

        $rejects(fn() => $setup->complete(['setupCode' => 'AAAA-BBBB-CCCC-DDDD'] + $body, '127.0.0.1'), 'INVALID_SETUP_CODE', 'Un código incorrecto debe rechazarse.');
        $rejects(fn() => $setup->complete(['password' => 'corta'] + $body, '127.0.0.1'), 'ADMIN_PASSWORD_TOO_SHORT', 'Una contraseña corta debe rechazarse.');
        $rejects(fn() => $setup->complete(['username' => 'a b'] + $body, '127.0.0.1'), 'INVALID_USERNAME', 'Un usuario inválido debe rechazarse.');
        $rejects(fn() => $setup->complete(['timezone' => 'Marte/Base'] + $body, '127.0.0.1'), 'INVALID_ESTABLISHMENT', 'Una zona horaria inválida debe rechazarse.');
        $check($db->table('establecimientos')->countAllResults() === 0, 'Los intentos rechazados no deben dejar datos.');

        $result = $setup->complete($body, '127.0.0.1');
        $check($result['username'] === 'admin.nuevo' && !$setup->required(), 'La configuración debe crear la institución.');
        $check(!is_file(SetupCode::path()), 'El código debe eliminarse al usarse.');
        $session = (new AuthRepository())->login('admin.nuevo', 'una-clave-larga-segura', '127.0.0.1');
        $check(($session['user']['role'] ?? null) === 'ADMIN', 'El administrador creado debe poder ingresar.');
        $audit = $db->table('registros_auditoria')->where('accion', 'CONFIGURACION_INICIAL')->get()->getRowArray();
        $check($audit && (string)$audit['id_establecimiento'] === $result['establishmentId'], 'La configuración debe quedar auditada en su institución.');
        $rejects(fn() => $setup->complete($body, '127.0.0.1'), 'SETUP_COMPLETED', 'Una segunda configuración debe rechazarse.');
        $check($setup->status() === ['required' => false] && !is_file(SetupCode::path()), 'Una instalación configurada no debe volver a generar código.');
        // Console password reset for a forgotten credential.
        $auth = new AuthRepository();
        $rejects(fn() => UserAccounts::resetPassword($db, 'admin.nuevo', 'corta'), 'PASSWORD_TOO_SHORT', 'Una contraseña nueva corta debe rechazarse.');
        $rejects(fn() => UserAccounts::resetPassword($db, 'nadie', 'otra-clave-larga-segura'), 'USER_NOT_FOUND', 'Un usuario inexistente debe informarse.');
        $db->table('usuarios')->where('nombre_usuario', 'admin.nuevo')->update(['intentos_fallidos' => 4, 'bloqueado_hasta' => gmdate('Y-m-d H:i:s', time() + 900)]);
        UserAccounts::resetPassword($db, 'admin.nuevo', 'otra-clave-larga-segura');
        $check($auth->sessionUser($session['token']) === null, 'El restablecimiento debe cerrar las sesiones abiertas.');
        $check(isset($auth->login('admin.nuevo', 'una-clave-larga-segura', '127.0.0.1')['error']), 'La contraseña anterior debe dejar de servir.');
        $check(($auth->login('admin.nuevo', 'otra-clave-larga-segura', '127.0.0.1')['user']['role'] ?? null) === 'ADMIN', 'La contraseña nueva debe servir y desbloquear la cuenta.');
        $check($db->table('registros_auditoria')->where('accion', 'RESTABLECER_CONTRASENA')->where('id_establecimiento', $result['establishmentId'])->countAllResults() === 1, 'El restablecimiento debe auditarse.');
        echo "Configuración inicial: código de un solo uso, validaciones, cuenta creada y cierre verificados. Restablecimiento de contraseña verificado.\n";
    }
}
