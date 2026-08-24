import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Person } from './entities/person.entity';
import { FaceEmbedding } from './entities/face-embedding.entity';
import { CreatePersonDto } from '@security-ai/shared';

@Injectable()
export class PeopleService {
  constructor(
    @InjectRepository(Person)
    private readonly personRepo: Repository<Person>,
    @InjectRepository(FaceEmbedding)
    private readonly embeddingRepo: Repository<FaceEmbedding>,
  ) {}

  async findAll(): Promise<Person[]> {
    return this.personRepo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<Person> {
    const person = await this.personRepo.findOne({
      where: { id },
      relations: ['embeddings'],
    });
    if (!person) throw new NotFoundException(`Person ${id} not found`);
    return person;
  }

  async create(dto: CreatePersonDto): Promise<Person> {
    const person = this.personRepo.create({
      name: dto.name,
      enabled: dto.enabled ?? true,
    });
    return this.personRepo.save(person);
  }

  async update(id: string, dto: Partial<CreatePersonDto>): Promise<Person> {
    const person = await this.findOne(id);
    Object.assign(person, dto);
    return this.personRepo.save(person);
  }

  async remove(id: string): Promise<void> {
    const person = await this.findOne(id);
    await this.personRepo.remove(person);
  }

  async addEmbedding(personId: string, embedding: number[]): Promise<FaceEmbedding> {
    await this.findOne(personId);
    const emb = this.embeddingRepo.create({
      personId,
      embedding: JSON.stringify(embedding),
    });
    return this.embeddingRepo.save(emb);
  }

  async getEmbeddings(personId: string): Promise<FaceEmbedding[]> {
    return this.embeddingRepo.find({ where: { personId } });
  }
}
