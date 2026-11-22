<?php
namespace App\Controllers;
use App\Models\{AccountRepository, CatalogRepository};
class AdminController extends BaseApiController {
    public function accounts() { return $this->attempt(fn()=> $this->jsonResponse(['accounts'=>(new AccountRepository($this->getAuthUser()))->listing()])); }
    public function createAccount() {
        return $this->attempt(fn()=> $this->jsonResponse(['account'=>(new AccountRepository($this->getAuthUser()))->create($this->getRequestBody())],201));
    }
    public function drivers() { return $this->jsonResponse(['drivers'=>(new CatalogRepository())->drivers($this->getEstablishmentId())]); }
    public function driver(string $id) {
        return $this->attempt(fn()=> $this->jsonResponse(['driver'=>(new CatalogRepository())->driver($id,$this->getEstablishmentId())]));
    }
}
