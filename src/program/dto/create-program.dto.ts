// TODO Reto 1: reglas de validación con class-validator
//   - name: string, mínimo 3 caracteres
//   - code: string de 3 a 6 letras MAYÚSCULAS (ej. "SIS", "MED")
//   - credits: entero positivo

import { IsInt, IsPositive, IsString, Max, Min } from "class-validator";

export class CreateProgramDto {

    @IsString()
    @Min(3)
    name: string;

    @IsString()
    @Min(3)
    @Max(6)
    code: string;

    @IsInt()
    @IsPositive()
    credits: number;
}
