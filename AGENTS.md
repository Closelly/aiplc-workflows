# Closelly AI-PLC Workflows

Este repositorio contiene el motor y la distribución de la metodología. Los repositorios
generados por `po init` son independientes. Consulta [README.md](README.md) para ejecutar
la CLI y [el diseño del motor](docs/architecture.md) antes de cambiar estados, roles o validadores.

Mantén PO y DEV como flujos separados. Las pruebas de integración deben crear repositorios
temporales. No persistas credenciales ni ejecutes acciones externas como efecto de los tests.
