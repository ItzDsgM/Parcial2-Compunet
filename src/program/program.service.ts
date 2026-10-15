import { BadRequestException, ConflictException, HttpException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Program } from './entities/program.entity';
import { Student } from 'src/student/entities/student.entity';
import { CreateProgramDto } from './dto/create-program.dto';
import { User } from 'src/user/entities/user.entity';
import { PaginationDto } from 'src/student/dto/pagination.dto';
import { isUUID } from 'class-validator';
import { AssignStudentsDto } from './dto/assign-students.dto';

@Injectable()
export class ProgramService {

    // TODO Reto 1: inyecta el repositorio de Program (y lo que necesites para las transacciones)
    private readonly logger = new Logger("ProgramService");

    constructor(
        @InjectRepository(Program)
        private readonly programrRepository : Repository<Program>,
        
        @InjectRepository(Student)
        private readonly studentRepositoty : Repository<Student>,

        private readonly datasource : DataSource,
    ){}

    // TODO Reto 1: create(createProgramDto, user) -> guarda el programa
    //   - nombre o código repetido -> 409 Conflict (no 500)

    async create(createProgramDto: CreateProgramDto, user: User){
        try{
            const program = this.programrRepository.create({
                ...createProgramDto,
                createdBy: user
            });
            await this.programrRepository.save(program);
            return program;
        }catch(error){
            this.handleException(error);
        }
    }

    // TODO Reto 1: findAll(paginationDto) -> lista paginada (limit / skip)
    getAll(paginationDto: PaginationDto){
        const { limit, skip } = paginationDto;
        return this.programrRepository.find({
            take: limit,
            skip: skip
        });
    }

    // TODO Reto 2: findOne(id) -> programa con sus estudiantes, 404 si no existe
    async findOne(term: string){
        let program: Program | null;

        if(isUUID(term)){
            program = await this.programrRepository.findOne({
                where: { id: term },
                relations: { students: true }
            });
        }else{
            program = await this.programrRepository.createQueryBuilder("program")
                .where("UPPER(program.name) = :name", { name: term.toUpperCase() })
                .leftJoinAndSelect("program.students", "students")
                .getOne();
        }

        if(!program) throw new NotFoundException(`Club ${term} not found`);

        return program;
    }

    // TODO Reto 2: assignStudents(id, assignStudentsDto) -> AGREGA estudiantes al programa
    //   dentro de una transacción (QueryRunner), conservando los que ya tenía.
    //   Mismo patrón del update de estudiantes corregido en clase (combinar las notas):
    //   traer los actuales -> combinar con los nuevos -> guardar la lista completa.
    //   Si algún id no existe: 404 y rollback.

    async addMembers(id: string, assignStudents: AssignStudentsDto){
        const program = await this.findOne(id);

        const queryRunner = this.datasource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try{
            for(const email of assignStudents.studentIds){
            
                const result = await queryRunner.manager.update(Student, { email }, { program: { id } });
                if(!result.affected)
                    throw new NotFoundException(`Student with email ${email} not found`);
            }

            await queryRunner.commitTransaction();
        }catch(error){
            await queryRunner.rollbackTransaction();
            this.handleException(error);
        }finally{
            await queryRunner.release();
        }

        return this.findOne(id);
    }


    // TODO Reto 3: bulkCreate(bulkCreateProgramDto, user) -> crea todos los programas o ninguno
    //   (transacción). Cualquier nombre/código repetido -> 409 y rollback.


    private handleException(error: any): never{
        // Si el error ya es una excepción HTTP conocida (ej. NotFoundException, BadRequestException), se propaga directamente
        if(error instanceof HttpException) throw error;

        // Código de error nativo de PostgreSQL para violación de restricción de unicidad
        if(error.code === '23505')
            throw new ConflictException(error.detail);

        this.logger.error(error);
        throw new InternalServerErrorException('Unexpected error, check server logs');
    }
}
