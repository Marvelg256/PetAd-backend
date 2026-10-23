import { NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { AdoptionPolicy } from './adoption.policy';
import { CustodyPolicy } from './custody.policy';
import { DocumentPolicy } from './document.policy';
import {
  AdoptionPolicyResource,
  CustodyPolicyResource,
  DocumentPolicyResource,
  isAdmin,
  PolicyActor,
  PolicyRequirement,
  PolicySubject,
} from './policy.types';

type PolicyPrisma = Pick<PrismaClient, 'adoption' | 'custody' | 'document'>;

const adoptionPolicy = new AdoptionPolicy();
const custodyPolicy = new CustodyPolicy();
const documentPolicy = new DocumentPolicy();

/**
 * Prisma's `findFirstOrThrow` raises P2025 when no row matches. We translate
 * that into a 404 so a foreign resource is indistinguishable from a missing
 * one, which is the whole point of loading with the actor's own filter.
 */
async function findOrNotFound<T>(
  query: () => Promise<T>,
  resourceName: string,
): Promise<T> {
  try {
    return await query();
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new NotFoundException(`${resourceName} not found`);
    }
    throw error;
  }
}

/**
 * Loads an adoption the actor is allowed to see at all: admins can load any
 * adoption, participants only their own. Anything else is a 404.
 */
export function loadAdoptionForActor(
  prisma: PolicyPrisma,
  actor: PolicyActor,
  adoptionId: string,
): Promise<AdoptionPolicyResource> {
  const where: Prisma.AdoptionWhereInput = { id: adoptionId };

  if (!isAdmin(actor)) {
    where.OR = [{ adopterId: actor.userId }, { ownerId: actor.userId }];
  }

  return findOrNotFound(
    () =>
      prisma.adoption.findFirstOrThrow({
        where,
        select: { id: true, adopterId: true, ownerId: true },
      }),
    'Adoption',
  );
}

/**
 * Loads a custody the actor holds or owns a pet in. The pet is included so
 * the policy can resolve the "owner" role without a second query.
 */
export function loadCustodyForActor(
  prisma: PolicyPrisma,
  actor: PolicyActor,
  custodyId: string,
): Promise<CustodyPolicyResource> {
  const where: Prisma.CustodyWhereInput = { id: custodyId };

  if (!isAdmin(actor)) {
    where.OR = [
      { holderId: actor.userId },
      { pet: { currentOwnerId: actor.userId } },
    ];
  }

  return findOrNotFound(
    () =>
      prisma.custody.findFirstOrThrow({
        where,
        select: {
          id: true,
          holderId: true,
          pet: { select: { currentOwnerId: true } },
        },
      }),
    'Custody',
  );
}

/**
 * Loads a document the actor uploaded or that belongs to an adoption they are
 * party to.
 */
export function loadDocumentForActor(
  prisma: PolicyPrisma,
  actor: PolicyActor,
  documentId: string,
): Promise<DocumentPolicyResource> {
  const where: Prisma.DocumentWhereInput = { id: documentId };

  if (!isAdmin(actor)) {
    where.OR = [
      { uploadedById: actor.userId },
      { adoption: { adopterId: actor.userId } },
      { adoption: { ownerId: actor.userId } },
    ];
  }

  return findOrNotFound(
    () =>
      prisma.document.findFirstOrThrow({
        where,
        select: {
          id: true,
          uploadedById: true,
          adoption: { select: { adopterId: true, ownerId: true } },
        },
      }),
    'Document',
  );
}

/**
 * Loads the resource named by the requirement and throws 404 when the actor
 * cannot act on it. A participant who is denied a specific action also gets a
 * 404 so the endpoint does not leak resource existence.
 */
export async function enforcePolicy(
  prisma: PolicyPrisma,
  requirement: PolicyRequirement,
  actor: PolicyActor,
  resourceId: string,
): Promise<void> {
  switch (requirement.subject) {
    case PolicySubject.ADOPTION: {
      const adoption = await loadAdoptionForActor(prisma, actor, resourceId);
      if (!adoptionPolicy.allows(actor, adoption, requirement.action)) {
        throw new NotFoundException('Adoption not found');
      }
      return;
    }

    case PolicySubject.CUSTODY: {
      const custody = await loadCustodyForActor(prisma, actor, resourceId);
      if (!custodyPolicy.allows(actor, custody, requirement.action)) {
        throw new NotFoundException('Custody not found');
      }
      return;
    }

    case PolicySubject.DOCUMENT: {
      const document = await loadDocumentForActor(prisma, actor, resourceId);
      if (!documentPolicy.allows(actor, document, requirement.action)) {
        throw new NotFoundException('Document not found');
      }
      return;
    }

    default:
      throw new NotFoundException('Resource not found');
  }
}
