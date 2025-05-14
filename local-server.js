/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */
const serverPath = './server/server.js';
console.log(`Iniciando servidor desde: ${serverPath}`);

try {
  require(serverPath);
  console.log('Servidor iniciado correctamente');
} catch (error) {
  console.error('Error al iniciar el servidor:', error);
  process.exit(1);
}