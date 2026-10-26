<?php
namespace App\Models;
use Config\Database;
final class SystemRepository {
    public function healthy(): bool { return (int)Database::connect()->query('SELECT 1 as alive')->getRow()->alive===1; }
}
