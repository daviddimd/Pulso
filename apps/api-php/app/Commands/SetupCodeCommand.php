<?php
namespace App\Commands;

use App\Libraries\SetupCode;
use App\Models\SetupRepository;
use CodeIgniter\CLI\{BaseCommand, CLI};

final class SetupCodeCommand extends BaseCommand
{
    protected $group = 'Pulso';
    protected $name = 'pulso:codigo-configuracion';
    protected $description = 'Muestra el código de un solo uso para la página /configurar de una instalación nueva.';

    public function run(array $params)
    {
        if (!(new SetupRepository())->required()) {
            CLI::write('Pulso ya está configurado; /configurar está cerrado.', 'yellow');
            return EXIT_SUCCESS;
        }
        CLI::write('Código de configuración: ' . SetupCode::ensure(), 'green');
        CLI::write('Ábrelo en /configurar. Deja de servir al crear la primera institución.');
        return EXIT_SUCCESS;
    }
}
