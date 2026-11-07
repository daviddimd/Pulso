<?php
namespace App\Controllers;
use App\Models\CatalogRepository;
class AdminController extends BaseApiController {
    public function drivers() { return $this->jsonResponse(['drivers'=>(new CatalogRepository())->drivers($this->getEstablishmentId())]); }
    public function driver(string $id) {
        return $this->attempt(fn()=> $this->jsonResponse(['driver'=>(new CatalogRepository())->driver($id,$this->getEstablishmentId())]));
    }
}
