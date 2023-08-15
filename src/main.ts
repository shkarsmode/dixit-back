import { NestFactory } from '@nestjs/core';
import { createServer } from 'http';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    app.enableCors({
        origin: [
        'http://localhost:3000',
        'http://localhost:4200',
        ],
        methods: ["GET", "POST", "UPDATE"],
        credentials: true,
    });

    const server = createServer(app.getHttpAdapter().getInstance());

    // Pass the server to Socket.IO
    const io = require('socket.io')(server, {
        cors: {
            origin: '*',
            methods: ["GET", "POST", "UPDATE"],
            allowedHeaders: '*',
            credentials: true,
        },
    });

    await app.listen(3000);
}
bootstrap();
