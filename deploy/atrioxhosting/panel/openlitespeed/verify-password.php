<?php
if ($argc !== 3 || !password_verify($argv[1], $argv[2])) {
    exit(1);
}
