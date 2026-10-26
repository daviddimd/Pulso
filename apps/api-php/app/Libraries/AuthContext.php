<?php
namespace App\Libraries;
/** Per-request identity, populated exclusively from the validated session token. */
final class AuthContext { public static ?array $user = null; }
