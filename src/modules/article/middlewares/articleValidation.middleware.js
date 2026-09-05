import { articleExists } from '../../article/services/article.service.js';
import { checkAuthorsExistence } from '../../author/services/author.service.js';

export const validateCreateArticle = async (request, reply) => {
  const { title, publication_year, issue_id, primary_topic, sub_topic, authors, keywords } = request.body;

  if (!title || title.trim() === "") return reply.status(400).send({ success: false, code: "TITLE_REQUIRED", message: "Title is required" });
  if (publication_year === undefined || publication_year === null) return reply.status(400).send({ success: false, code: "PUBLICATION_YEAR_REQUIRED", message: "Publication year is required" });
  if (typeof publication_year !== "number") return reply.status(400).send({ success: false, code: "PUBLICATION_YEAR_INVALID", message: "Publication year must be a number" });
  if (issue_id !== undefined && issue_id !== null && typeof issue_id !== "number") return reply.status(400).send({ success: false, code: "ISSUE_ID_INVALID", message: "Issue ID must be a number" });
  if (primary_topic !== undefined && primary_topic !== null && typeof primary_topic !== "number") return reply.status(400).send({ success: false, code: "PRIMARY_TOPIC_INVALID", message: "Primary topic must be a number" });

  if (authors !== undefined && !Array.isArray(authors)) return reply.status(400).send({ success: false, code: "AUTHORS_INVALID", message: "Authors must be an array of author IDs" });
  
  if (Array.isArray(authors)) {
    if (!authors.every((id) => Number.isInteger(id))) return reply.status(400).send({ success: false, code: "AUTHORS_INVALID", message: "Each author ID must be an integer" });
    if (authors.length > 0) {
      try {
        const authorIdsNotExist = await checkAuthorsExistence(authors);
        if (authorIdsNotExist.length > 0) return reply.status(400).send({ success: false, code: "AUTHORS_NOT_FOUND", message: `CÃ¡c tÃ¡c giáº£ vá»›i ID sau khÃ´ng tá»“n táº¡i: ${authorIdsNotExist.join(", ")}` });
      } catch (error) {
        return reply.status(500).send({ success: false, code: "INTERNAL_SERVER_ERROR", message: "Lá»—i há»‡ thá»‘ng khi xÃ¡c thá»±c tÃ¡c giáº£!" });
      }
    }
  }

  if (keywords !== undefined && keywords !== null) {
    if (Array.isArray(keywords)) {
      if (!keywords.every((kw) => typeof kw === "string")) return reply.status(400).send({ success: false, code: "KEYWORDS_INVALID", message: "Each keyword must be a string when keywords is an array" });
    } else if (typeof keywords === "object") {
      const invalidKeyword = Object.entries(keywords).find(([keyword, score]) => typeof keyword !== "string" || keyword.trim() === "" || typeof score !== "number");
      if (invalidKeyword) return reply.status(400).send({ success: false, code: "KEYWORDS_INVALID", message: "Keywords must be an object mapping string keyword names to numeric scores" });
    } else {
      return reply.status(400).send({ success: false, code: "KEYWORDS_INVALID", message: "Keywords must be an array or object" });
    }
  }

  if (sub_topic !== undefined && !Array.isArray(sub_topic)) return reply.status(400).send({ success: false, code: "SUB_TOPIC_INVALID", message: "Sub_topic must be an array of strings or IDs" });
  if (Array.isArray(sub_topic) && !sub_topic.every((item) => typeof item === "string" || Number.isInteger(item))) return reply.status(400).send({ success: false, code: "SUB_TOPIC_INVALID", message: "Each sub_topic item must be a string or integer" });
};

export const validateUpdateArticle = async (request, reply) => {
  const dataBody = request.body;
  if (dataBody.sub_topic !== undefined && !Array.isArray(dataBody.sub_topic)) return reply.status(400).send({ success: false, code: "SUB_TOPIC_INVALID", message: "sub_topic pháº£i lÃ  máº£ng" });

  if (dataBody.authors !== undefined) {
    if (!Array.isArray(dataBody.authors)) return reply.status(400).send({ success: false, code: "AUTHORS_INVALID", message: "authors pháº£i lÃ  máº£ng" });
    const normalizedAuthors = dataBody.authors.map((item) => {
      if (typeof item === "object" && item !== null) return Number(item.author_id || item.id);
      return Number(item);
    }).filter((id) => !isNaN(id) && id > 0);

    if (normalizedAuthors.length > 0) {
      try {
        const authorIdsNotExist = await checkAuthorsExistence(normalizedAuthors);
        if (authorIdsNotExist.length > 0) return reply.status(400).send({ success: false, code: "AUTHORS_NOT_FOUND", message: `CÃ¡c tÃ¡c giáº£ vá»›i ID sau khÃ´ng tá»“n táº¡i: ${authorIdsNotExist.join(", ")}` });
      } catch (error) {
        return reply.status(500).send({ success: false, code: "INTERNAL_SERVER_ERROR", message: "Lá»—i há»‡ thá»‘ng khi xÃ¡c thá»±c tÃ¡c giáº£!" });
      }
    }
    request.body.authors = normalizedAuthors;
  }

  if (dataBody.keywords !== undefined) {
    if (Array.isArray(dataBody.keywords)) {
      if (!dataBody.keywords.every((kw) => typeof kw === "string")) return reply.status(400).send({ success: false, code: "KEYWORDS_INVALID", message: "Each keyword must be a string when keywords is an array" });
    } else if (dataBody.keywords !== null && typeof dataBody.keywords === "object") {
      const invalidKeyword = Object.entries(dataBody.keywords).find(([keyword, score]) => typeof keyword !== "string" || keyword.trim() === "" || typeof score !== "number");
      if (invalidKeyword) return reply.status(400).send({ success: false, code: "KEYWORDS_INVALID", message: "Keywords must be an object mapping string keyword names to numeric scores" });
    } else {
      return reply.status(400).send({ success: false, code: "KEYWORDS_INVALID", message: "Keywords must be an array or object" });
    }
  }
};

export const validateId = async (request, reply) => {
  const { id } = request.params;
  if (!Number.isInteger(Number(id))) return reply.status(400).send({ success: false, code: "ID_INVALID", message: "ID pháº£i lÃ  má»™t sá»‘ nguyÃªn" });

  if (await articleExists(Number(id)) === false) return reply.status(404).send({ success: false, code: "ARTICLE_NOT_FOUND", message: "KhÃ´ng tÃ¬m tháº¥y Article vá»›i ID Ä‘Ã£ cho" });
};
