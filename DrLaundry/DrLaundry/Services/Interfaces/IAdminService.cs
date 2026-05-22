using DrLaundry.DTOs;

namespace DrLaundry.Services.Interfaces
{
    public interface IAdminService
    {
        Task<ApiResponse<string>> MakeAdmin(string email);
        Task<ApiResponse<string>> RemoveAdmin(string email);
        Task<ApiResponse<bool>> IsAdmin(string email);
    }
}