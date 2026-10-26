<?php
namespace App\Controllers;
class FrontendController extends BaseController {
    public function index() {
        $file=FCPATH.'index.html';
        if(!is_file($file)) return $this->response->setStatusCode(503)->setBody('La interfaz no está compilada. Ejecuta npm run build.');
        return $this->response->setContentType('text/html')->setBody(file_get_contents($file));
    }
}
