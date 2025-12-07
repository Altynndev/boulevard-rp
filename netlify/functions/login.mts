import type { Context, Config } from "@netlify/functions";
import mysql from "mysql2/promise";

interface LoginRequest {
  username: string;
  password: string;
}

interface AccountRow {
  user_name: string;
  password: string;
}

export default async (req: Request, context: Context) => {
  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, message: "Método no permitido" }),
      {
        status: 405,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    const body: LoginRequest = await req.json();
    const { username, password } = body;

    // Validate input
    if (!username || !password) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Usuario y contraseña son requeridos",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get database credentials from environment variables
    const dbHost = Netlify.env.get("SQL_HOSTNAME");
    const dbUser = Netlify.env.get("SQL_USERNAME");
    const dbName = Netlify.env.get("SQL_DATABASE");
    const dbPassword = Netlify.env.get("SQL_PASSWORD");

    if (!dbHost || !dbUser || !dbName || !dbPassword) {
      console.error("Database credentials not configured");
      return new Response(
        JSON.stringify({
          success: false,
          message: "Error de configuración del servidor",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Create database connection
    const connection = await mysql.createConnection({
      host: dbHost,
      user: dbUser,
      database: dbName,
      password: dbPassword,
      connectTimeout: 10000,
    });

    try {
      // Query the accounts table
      const [rows] = await connection.execute<mysql.RowDataPacket[]>(
        "SELECT user_name, password FROM accounts WHERE user_name = ? LIMIT 1",
        [username]
      );

      await connection.end();

      if (rows.length === 0) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Usuario o contraseña incorrectos",
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const account = rows[0] as AccountRow;

      // Compare passwords (assuming passwords are stored as plain text or you need to implement your hashing logic)
      // Note: In production, you should use proper password hashing like bcrypt
      if (account.password === password) {
        return new Response(
          JSON.stringify({
            success: true,
            message: "Inicio de sesión exitoso",
            user: { username: account.user_name },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      } else {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Usuario o contraseña incorrectos",
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    } catch (dbError) {
      await connection.end();
      throw dbError;
    }
  } catch (error) {
    console.error("Login error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: "Error al procesar la solicitud",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

export const config: Config = {
  path: "/api/login",
};
