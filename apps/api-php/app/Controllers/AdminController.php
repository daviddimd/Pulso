<?php
namespace App\Controllers;
use App\Models\CatalogRepository;
class AdminController extends BaseApiController {
    public function drivers() { return $this->jsonResponse(['drivers'=>(new CatalogRepository())->drivers($this->getEstablishmentId())]); }
}
