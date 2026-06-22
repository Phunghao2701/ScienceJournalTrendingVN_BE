import { journalExist } from '../services/journal.service.js';
import { publisherExist } from '../services/publisher.service.js';
import { zoneExist } from '../services/zone.service.js';

/**
 * Middleware kiểm tra tính hợp lệ của dữ liệu đầu vào khi tạo mới một Journal.
 * Kiểm tra các trường bắt buộc, định dạng dữ liệu, và logic liên quan đến database (như publisher_id, country, region).
 * Nếu dữ liệu không hợp lệ, trả về lỗi 400 với thông báo chi tiết. Nếu có lỗi hệ thống, trả về lỗi 500.
 * @param {Object} req - Express request object
 * @param {Object} req.body - Dữ liệu JSON gửi lên từ client để tạo mới Journal
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void|Object} Gọi hàm next() nếu dữ liệu hợp lệ, ngược lại trả về response lỗi 400 hoặc 500
 */
export const validateCreateJournal = async (req, res, next) => {
  try {
    const { 
      source_id, publisher_id, country, region, 
      display_name, type, is_open_access, is_oa_diamond, 
      coverage, issn, scope_detail 
    } = req.body;

    // 1. Kiểm tra display_name
    if (!display_name || typeof display_name !== 'string' || display_name.trim() === '') {
      return res.status(400).json({
        success: false,
        code: 'INVALID_DISPLAY_NAME', // Mã lỗi sau này dễ quản lý
        message: 'display_name là trường bắt buộc và phải là chuỗi không trống'
      });
    }

    // 2. Gán giá trị mặc định cho type
    if (!type || typeof type !== 'string' || type.trim() === '') {
      req.body.type = 'Journal'; 
    } else {
      req.body.type = type.trim();
    }

    // 3. Gán giá trị mặc định cho các trường Boolean logic
    if (typeof is_open_access !== 'boolean') {
      req.body.is_open_access = false;
    }
    if (typeof is_oa_diamond !== 'boolean') {
      req.body.is_oa_diamond = false;
    }

    // 4. Kiểm tra chuỗi/list ISSN
    const issnRegex = /^\d{4}-\d{3}[\dX]$/; 

    if (issn !== undefined && issn !== null && issn !== '') {
      if (typeof issn === 'string') {
        const issnList = issn.split(',').map(item => item.trim());
        const invalidIssns = issnList.filter(item => !issnRegex.test(item));
        
        if (invalidIssns.length > 0) {
          return res.status(400).json({
            success: false,
            code: 'INVALID_ISSN_FORMAT',
            message: `Định dạng ISSN không hợp lệ: ${invalidIssns.join(', ')}. Định dạng đúng phải là XXXX-XXXX`
          });
        }
      } else if (Array.isArray(issn)) {
        const invalidIssns = issn.filter(item => typeof item !== 'string' || !issnRegex.test(item.trim()));
        if (invalidIssns.length > 0) {
          return res.status(400).json({
            success: false,
            code: 'INVALID_ISSN_ARRAY',
            message: 'Mảng chứa một hoặc nhiều mã ISSN không đúng định dạng (XXXX-XXXX)'
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          code: 'INVALID_ISSN_TYPE',
          message: 'issn phải là chuỗi (string) hoặc mảng (array)'
        });
      }
    }

    // 5. Kiểm tra logic Database cho publisher_id
    if (publisher_id !== undefined && publisher_id !== null && publisher_id !== '') {
      const publisherExists = await publisherExist(publisher_id);
      if (!publisherExists) {
        return res.status(400).json({
          success: false,
          code: 'PUBLISHER_NOT_FOUND',
          message: 'publisher_id không tồn tại trong hệ thống'
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        code: 'PUBLISHER_REQUIRED',
        message: 'publisher_id là trường bắt buộc'
      });
    }

    // 6. Kiểm tra logic Database cho country
    if (country !== undefined && country !== null && country !== '') {
      const countryExists = await zoneExist(country);
      if (!countryExists) {
        return res.status(400).json({
          success: false,
          code: 'COUNTRY_NOT_FOUND',
          message: 'country không tồn tại trong hệ thống'
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        code: 'COUNTRY_REQUIRED',
        message: 'country là trường bắt buộc'
      });
    }

    // 7. Kiểm tra logic Database cho region
    if (region !== undefined && region !== null && region !== '') {
      const regionExists = await zoneExist(region);
      if (!regionExists) {
        return res.status(400).json({
          success: false,
          code: 'REGION_NOT_FOUND',
          message: 'region không tồn tại trong hệ thống'
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        code: 'REGION_REQUIRED',
        message: 'region là trường bắt buộc'
      });
    }
    
    // Nếu vượt qua tất cả các chốt chặn trên, đi tiếp tới Controller
    next();

  } catch (error) {
    return res.status(500).json({
      success: false,
      code: 'SERVER_VALIDATION_ERROR',
      message: 'Lỗi hệ thống trong quá trình kiểm tra dữ liệu',
      error: error.message
    });
  }
};

/**
 * Middleware kiểm tra tính hợp lệ của dữ liệu đầu vào khi cập nhật một Journal.
 * Cho phép bỏ qua một số trường không bắt buộc, nhưng nếu có thì phải hợp lệ. Kiểm tra logic liên quan đến database (như publisher_id, country, region).
 * Nếu dữ liệu không hợp lệ, trả về lỗi 400 với thông báo chi tiết. Nếu có lỗi hệ thống, trả về lỗi 500.
 * @param {Object} req - Express request object
 * @param {Object} req.body - Dữ liệu JSON gửi lên từ client để cập nhật Journal
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @return {void|Object} Gọi hàm next() nếu dữ liệu hợp lệ, ngược lại trả về response lỗi 400 hoặc 500
 * Lưu ý: Khi cập nhật, các trường như display_name, publisher_id, country, region có thể không bắt buộc phải có trong request body, nhưng nếu có thì phải hợp lệ. Các trường khác như type, is_open_access, is_oa_diamond cũng sẽ được kiểm tra nếu có trong request.
 */
export const validateUpdateJournal = async (req, res, next) => {
  try {
      const {
        publisher_id, country, region,
        display_name, type, is_open_access, is_oa_diamond,
        coverage, issn, scope_detail
      } = req.body;

      if(publisher_id !== undefined) {
        const publisherExists = await publisherExist(publisher_id);
        if (!publisherExists) {
          return res.status(400).json({
            success: false,
            code: 'PUBLISHER_NOT_FOUND',
            message: 'publisher_id không tồn tại trong hệ thống'
          });
        }
      }

      if(country !== undefined) {
        const countryExists = await zoneExist(country);
        if (!countryExists) {
          return res.status(400).json({
            success: false,
            code: 'COUNTRY_NOT_FOUND',
            message: 'country không tồn tại trong hệ thống'
          });
        }
      }

      if(region !== undefined) {
        const regionExists = await zoneExist(region);
        if (!regionExists) {
          return res.status(400).json({
            success: false,
            code: 'REGION_NOT_FOUND',
            message: 'region không tồn tại trong hệ thống'
          });
        }
      }

      if (!type || typeof type !== 'string' || type.trim() === '') {
        req.body.type = 'Journal'; 
      } else {
        req.body.type = type.trim();
      }

      if (is_open_access !== undefined && typeof is_open_access !== 'boolean') {
        req.body.is_open_access = false;
      }

      if (is_oa_diamond !== undefined && typeof is_oa_diamond !== 'boolean') {
        req.body.is_oa_diamond = false;
      }

      const issnRegex = /^\d{4}-\d{3}[\dX]$/; 

      if (issn !== undefined && issn !== null && issn !== '') {
        if (typeof issn === 'string') {
          const issnList = issn.split(',').map(item => item.trim());
          const invalidIssns = issnList.filter(item => !issnRegex.test(item));
          
          if (invalidIssns.length > 0) {
            return res.status(400).json({
              success: false,
              code: 'INVALID_ISSN_FORMAT',
              message: `Định dạng ISSN không hợp lệ: ${invalidIssns.join(', ')}. Định dạng đúng phải là XXXX-XXXX`
            });
          }
        } else if (Array.isArray(issn)) {
          const invalidIssns = issn.filter(item => typeof item !== 'string' || !issnRegex.test(item.trim()));
          if (invalidIssns.length > 0) {
            return res.status(400).json({
              success: false,
              code: 'INVALID_ISSN_ARRAY',
              message: 'Mảng chứa một hoặc nhiều mã ISSN không đúng định dạng (XXXX-XXXX)'
            });
          }
        } else {
          return res.status(400).json({
            success: false,
            code: 'INVALID_ISSN_TYPE',
            message: 'issn phải là chuỗi (string) dạng danh sách phân cách bằng dấu phẩy'
          });
        }
      }

      next();
  }catch (error) {
    return res.status(500).json({
      success: false,
      code: 'SERVER_VALIDATION_ERROR',
      message: 'Lỗi hệ thống trong quá trình kiểm tra dữ liệu',
    });
  }
}

export const validateJournalId = async (req, res, next) => {
  try {
    const { id } = req.params;
    const idNumber = Number(id);
    if (!Number.isInteger(idNumber) || idNumber <= 0) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_JOURNAL_ID',
        message: 'Id không hợp lệ, phải là số nguyên dương'
      });
    }

    if(!(await journalExist(idNumber))) {
      return res.status(404).json({
        success: false,
        code: 'JOURNAL_NOT_FOUND',
        message: `Không tìm thấy journal nào với id ${idNumber}`
      });
    }
    next();

  } catch (error) {
    return res.status(400).json({
        success: false,
        code: 'INVALID_JOURNAL_ID',
        message: 'Id không hợp lệ, phải là số nguyên dương'
      });
    }

}