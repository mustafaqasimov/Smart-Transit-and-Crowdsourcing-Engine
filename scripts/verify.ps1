$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
$qa = @('-f', 'compose.yaml', '-f', 'compose.qa.yaml')
docker compose @qa config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Compose configuration failed' }
$exists = docker compose exec -T db psql -U transit -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='transit_test'"
if ($LASTEXITCODE -ne 0) { throw 'Start Docker Compose before testing' }
if (($exists -join '').Trim() -ne '1') {
    docker compose exec -T db createdb -U transit transit_test
    if ($LASTEXITCODE -ne 0) { throw 'Test database creation failed' }
}
docker compose -f compose.yaml -f compose.test.yaml run --rm --build test
if ($LASTEXITCODE -ne 0) { throw 'Backend tests failed' }

# Browser tests: fresh transit_e2e database and a separate app container, so demo data stays untouched.
docker compose @qa rm -sf app-qa | Out-Null
docker compose exec -T db dropdb -U transit --if-exists transit_e2e
docker compose exec -T db createdb -U transit transit_e2e
if ($LASTEXITCODE -ne 0) { throw 'E2E database creation failed' }
docker compose @qa build app-qa ui-test
if ($LASTEXITCODE -ne 0) { throw 'QA image build failed' }
try {
    docker compose @qa run --rm ui-test
    if ($LASTEXITCODE -ne 0) { throw 'Browser tests failed' }
} finally {
    docker compose @qa rm -sf app-qa | Out-Null
}
Write-Output 'Backend, UI, real YOLO image and video checks passed. Demo database was not modified.'
