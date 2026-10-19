import SwiftUI

public struct MonthlyReportView: View {
    @ObservedObject var firebase = FirebaseService.shared
    @Environment(\.presentationMode) var presentationMode

    @State private var selectedYear: Int = Calendar.current.component(.year, from: Date())
    @State private var selectedMonth: Int = Calendar.current.component(.month, from: Date())

    private var primaryRed: Color {
        Color(red: 229/255, green: 57/255, blue: 53/255)
    }

    private var monthName: String {
        let df = DateFormatter()
        return "\(df.monthSymbols[selectedMonth - 1]) \(selectedYear)"
    }

    public init() {}

    public var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Month Selector Bar (matches Android MonthlyReportScreen)
                HStack {
                    Button(action: prevMonth) {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 18, weight: .bold))
                            .foregroundColor(primaryRed)
                            .padding(8)
                    }

                    Spacer()

                    Text(monthName)
                        .font(.system(size: 18, weight: .bold))
                        .foregroundColor(.black)

                    Spacer()

                    Button(action: nextMonth) {
                        Image(systemName: "chevron.right")
                            .font(.system(size: 18, weight: .bold))
                            .foregroundColor(primaryRed)
                            .padding(8)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                .background(Color.gray.opacity(0.06))

                let employees = firebase.getAllEmployees()
                if employees.isEmpty {
                    VStack(spacing: 12) {
                        Spacer()
                        Text("No employees found.")
                            .foregroundColor(.gray)
                        Spacer()
                    }
                } else {
                    ScrollView {
                        VStack(spacing: 14) {
                            ForEach(employees, id: \.self) { empId in
                                let settings = firebase.getEmployeeSettings(employeeId: empId)
                                let name = settings.displayName.isEmpty ? empId : settings.displayName
                                let calc = firebase.calculateSalaryForEmployee(employeeId: empId, year: selectedYear, month: selectedMonth)

                                VStack(alignment: .leading, spacing: 10) {
                                    Text(name)
                                        .font(.system(size: 17, weight: .bold))
                                        .foregroundColor(.black)
                                    Text(empId)
                                        .font(.caption)
                                        .foregroundColor(.gray)

                                    Divider()

                                    HStack {
                                        Text("Base Salary:")
                                            .foregroundColor(.gray)
                                        Spacer()
                                        Text("₹\(Int(calc.baseSalary))")
                                            .fontWeight(.semibold)
                                    }

                                    HStack {
                                        Text("Total Working Days:")
                                            .foregroundColor(.gray)
                                        Spacer()
                                        Text("\(calc.totalWorkingDays)")
                                    }

                                    HStack {
                                        Text("Days Present:")
                                            .foregroundColor(.gray)
                                        Spacer()
                                        Text("\(calc.presentDays)")
                                            .foregroundColor(Color(red: 46/255, green: 125/255, blue: 50/255))
                                    }

                                    HStack {
                                        Text("Approved Leaves:")
                                            .foregroundColor(.gray)
                                        Spacer()
                                        Text("\(calc.approvedLeaveDays)")
                                            .foregroundColor(primaryRed)
                                    }

                                    HStack {
                                        Text("Days Absent:")
                                            .foregroundColor(.gray)
                                        Spacer()
                                        Text("\(calc.absentDays)")
                                            .foregroundColor(Color.red)
                                    }

                                    HStack {
                                        Text("Per Day Salary:")
                                            .foregroundColor(.gray)
                                        Spacer()
                                        Text("₹\(Int(calc.perDaySalary))")
                                    }

                                    HStack {
                                        Text("Total Deduction:")
                                            .foregroundColor(.gray)
                                        Spacer()
                                        Text("₹\(Int(calc.deduction))")
                                            .foregroundColor(Color.red)
                                    }

                                    Divider()

                                    HStack {
                                        Text("Estimated Net Salary:")
                                            .fontWeight(.bold)
                                        Spacer()
                                        Text("₹\(Int(calc.netSalary))")
                                            .font(.system(size: 18, weight: .bold))
                                            .foregroundColor(Color(red: 46/255, green: 125/255, blue: 50/255))
                                    }
                                }
                                .padding(16)
                                .background(Color.white)
                                .cornerRadius(14)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 14)
                                        .stroke(Color.gray.opacity(0.2), lineWidth: 1)
                                )
                            }
                        }
                        .padding(16)
                    }
                }
            }
            .navigationTitle("Monthly Report")
            .navigationBarItems(trailing: Button("Done") { presentationMode.wrappedValue.dismiss() })
        }
    }

    private func prevMonth() {
        if selectedMonth == 1 {
            selectedMonth = 12
            selectedYear -= 1
        } else {
            selectedMonth -= 1
        }
    }

    private func nextMonth() {
        if selectedMonth == 12 {
            selectedMonth = 1
            selectedYear += 1
        } else {
            selectedMonth += 1
        }
    }
}
