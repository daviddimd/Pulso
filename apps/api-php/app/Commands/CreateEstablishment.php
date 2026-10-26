<?php
namespace App\Commands;
use CodeIgniter\CLI\{BaseCommand,CLI};
use App\Models\EstablishmentRepository;

final class CreateEstablishment extends BaseCommand
{
    protected $group='Pulso';
    protected $name='pulso:establishment';
    protected $description='Crea una institución independiente y su administrador inicial.';
    protected $usage='pulso:establishment <codigo> <nombre> <zona-horaria-IANA> <usuario-admin>';
    public function run(array $params) {
        if (count($params)!==4) { CLI::error($this->usage); return EXIT_ERROR; }
        // A dedicated environment variable avoids placing the password in command history.
        $password=getenv('PULSO_INITIAL_ADMIN_PASSWORD') ?: '';
        if (strlen($password)<12) { CLI::error('Define PULSO_INITIAL_ADMIN_PASSWORD con al menos 12 caracteres.'); return EXIT_ERROR; }
        try {
            (new EstablishmentRepository())->provision($params[0],$params[1],$params[2],$params[3],$password);
            CLI::write('Institución y administrador creados. Los catálogos de otras instituciones no se copiaron.','green');
        } catch (\Throwable $e) { CLI::error('No se pudo crear la institución. Comprueba código y usuario únicos, zona horaria y conexión.'); return EXIT_ERROR; }
        finally { putenv('PULSO_INITIAL_ADMIN_PASSWORD'); }
    }
}
