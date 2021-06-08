@echo off
cls
echo.
echo ***************************************
echo         REAP - Web Builder
echo ***************************************
echo.
echo.
yarn install --network-timeout 100000 && yarn build:prod && yarn build:war
