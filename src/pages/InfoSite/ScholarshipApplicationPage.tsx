import React, { useEffect, useState, useRef } from "react";
import {
  Space,
  Typography,
  Timeline,
  List,
  Descriptions,
  message,
  Button,
  Form,
  Modal,
  Select,
  Input,
  Table,
  Progress,
} from "antd";
import { useQuery, gql, useMutation, useApolloClient } from "@apollo/client";
import {
  GetRole,
  GetId,
  GetScholarshipApplications,
  GetScholarshipApplicationsVariables,
  GetScholarshipApplications_scholarship_application,
  UpdateScholarshipApplication,
  UpdateScholarshipApplicationVariables,
  GetScholarshipApplicationsForCounselors,
  GetScholarshipApplicationsForCounselors_scholarship_application,
  DeleteScholarshipApplication,
  DeleteScholarshipApplicationVariables,
  AddScholarshipApplication,
  AddScholarshipApplicationVariables,
} from "../../api/types";
import {
  GetScholarshipApplications as GET_SCHOLARSHIP_APPLICATIONS,
  UpdateScholarshipApplication as UPDATE_SCHOLARSHIP_APPLICATION,
  DeleteScholarshipApplication as DELETE_SCHOLARSHIP_APPLICATION,
  GetScholarshipApplicationsForCounselors as GET_SCHOLARSHIP_APPLICATIONS_FOR_COUNSELORS,
  AddScholarshipApplication as ADD_SCHOLARSHIP_APPLICATION,
} from "../../api/info_scholarship.graphql";
import isUrl from "is-url";
import { honors, scholarships } from "../../configs";
import { generateThankLetter } from "../../helpers/application";
import { ColumnProps, TableProps } from "antd/lib/table";
import { SearchOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import get from "lodash.get";
import { FilterDropdownProps } from "antd/lib/table/interface";

const { Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { confirm } = Modal;

const honorSelectOptions = honors.map((i) => (
  <Option key={i} value={i}>
    {i}
  </Option>
));

const scholarshipNames = Object.keys(scholarships);

const scholarshipSelectOptions = [...scholarshipNames, ""].map((i) => (
  <Option key={i} value={i}>
    {i || "全部"}
  </Option>
));

const classes = [6, 7, 8, 9].reduce<string[]>(
  (pre, year) => [
    ...pre,
    ...[1, 2, 3, 4, 5, 6, 7, 8].map((_class) => `无${year}${_class}`),
  ],
  []
);

const exportSelectOptions = ["全部", ...classes].map((_class) => (
  <Option key={_class} value={_class}>
    {_class}
  </Option>
));

const ScholarshipApplicationPage = () => {
  const { data: userData } = useQuery<GetRole & GetId>(gql`
    {
      role @client
      _id @client
    }
  `);

  const {
    loading: applicationLoading,
    error: applicationError,
    data: applicationData,
    refetch: refetchApplications,
  } = useQuery<GetScholarshipApplications, GetScholarshipApplicationsVariables>(
    GET_SCHOLARSHIP_APPLICATIONS,
    {
      variables: {
        _id: userData?._id!,
      },
      skip: userData?.role === "counselor",
    }
  );

  useEffect(() => {
    if (applicationError) {
      message.error("奖学金加载失败");
    }
  }, [applicationError]);

  const [applicationFormVisible, setApplicationFormVisible] = useState(false);
  const [editingApplication, setEditingApplication] = useState<
    GetScholarshipApplications_scholarship_application
  >();

  const [form] = Form.useForm();

  const [
    updateApplication,
    { loading: applicationUpdating, error: updateApplicationError },
  ] = useMutation<
    UpdateScholarshipApplication,
    UpdateScholarshipApplicationVariables
  >(UPDATE_SCHOLARSHIP_APPLICATION);

  useEffect(() => {
    if (updateApplicationError) {
      message.error("申请更新失败");
    }
  }, [updateApplicationError]);

  const handleApplicationEdit = async () => {
    try {
      form.validateFields();
    } catch {}

    const values = form.getFieldsValue();

    await updateApplication({
      variables: {
        id: editingApplication!.id,
        thank_letter: values.thank_letter,
        form_url: values.form_url,
      },
    });

    setApplicationFormVisible(false);
    setEditingApplication(undefined);
    form.resetFields();

    refetchApplications();
  };

  const [deleteApplication, { error: deleteApplicationError }] = useMutation<
    DeleteScholarshipApplication,
    DeleteScholarshipApplicationVariables
  >(DELETE_SCHOLARSHIP_APPLICATION);

  useEffect(() => {
    if (deleteApplicationError) {
      message.error("申请删除失败");
    }
  }, [deleteApplicationError]);

  const handleApplicationDelete = async (id: string) => {
    confirm({
      title: "确定要删除此申请吗？",
      icon: <ExclamationCircleOutlined />,
      content: "此操作不可恢复。",
      onOk: async () => {
        await deleteApplication({ variables: { id } });
        await refetchApplicationsForCounselors();
      },
    });
  };

  const {
    loading: applicationsForCounselorsLoading,
    error: applicationsForCounselorsError,
    data: applicationsForCounselors,
    refetch: refetchApplicationsForCounselors,
  } = useQuery<GetScholarshipApplicationsForCounselors>(
    GET_SCHOLARSHIP_APPLICATIONS_FOR_COUNSELORS,
    {
      skip: userData?.role !== "counselor",
    }
  );

  useEffect(() => {
    if (applicationsForCounselorsError) {
      message.error("申请加载失败");
    }
  }, [applicationsForCounselorsError]);

  const searchInput = useRef<Input>(null);

  const getColumnSearchProps: (
    dataIndex:
      | keyof GetScholarshipApplicationsForCounselors_scholarship_application
      | (
          | keyof GetScholarshipApplicationsForCounselors_scholarship_application
          | "name"
          | "class"
        )[],
    name: string
  ) => Partial<
    ColumnProps<GetScholarshipApplicationsForCounselors_scholarship_application>
  > = (dataIndex, name) => ({
    filterDropdown: ({
      setSelectedKeys,
      selectedKeys,
      confirm,
      clearFilters,
    }) => (
      <div
        css={`
          padding: 8px;
        `}
      >
        <Input
          ref={searchInput}
          placeholder={`搜索${name}`}
          value={selectedKeys[0]}
          onChange={(e) =>
            setSelectedKeys(e.target.value ? [e.target.value] : [])
          }
          onPressEnter={() => handleSearch(selectedKeys, confirm)}
          css={`
            width: 188px;
            margin-bottom: 8px;
            display: block;
          `}
        />
        <Button
          type="primary"
          onClick={() => handleSearch(selectedKeys, confirm)}
          icon={<SearchOutlined />}
          size="small"
          css={`
            width: 90px;
            margin-right: 8px;
          `}
        >
          搜索
        </Button>
        <Button
          onClick={() => handleReset(clearFilters)}
          size="small"
          css={`
            width: 90px;
          `}
        >
          重置
        </Button>
      </div>
    ),
    filterIcon: (filtered) => (
      <SearchOutlined
        type="search"
        style={{ color: filtered ? "#027dcd" : undefined }}
      />
    ),
    onFilter: (value, record) =>
      get(record, dataIndex)
        .toString()
        .toLowerCase()
        .includes(value.toString().toLowerCase()),
    onFilterDropdownVisibleChange: (visible) => {
      if (visible) {
        setTimeout(() => searchInput.current && searchInput.current.select());
      }
    },
  });

  const scholarshipColumnsForCounselor: TableProps<
    GetScholarshipApplicationsForCounselors_scholarship_application
  >["columns"] = [
    {
      title: "学号",
      dataIndex: ["student", "id"],
      key: "student_id",
      ...getColumnSearchProps(["student", "id"], "学号"),
    },
    {
      title: "姓名",
      dataIndex: ["student", "name"],
      key: "name",
      ...getColumnSearchProps(["student", "name"], "姓名"),
    },
    {
      title: "班级",
      dataIndex: ["student", "class"],
      key: "class",
      ...getColumnSearchProps(["student", "class"], "班级"),
    },
    {
      title: "荣誉",
      dataIndex: "honor",
      key: "honor",
      filters: honors.map((honor) => ({
        text: honor,
        value: honor,
      })),
      onFilter: (value, record) => record.honor === value,
    },
    {
      title: "奖学金",
      dataIndex: "scholarship",
      key: "scholarship",
      filters: scholarshipNames.map((scholarship) => ({
        text: scholarship,
        value: scholarship,
      })),
      onFilter: (value, record) => record.scholarship === value,
    },
    {
      title: "代码",
      dataIndex: "code",
      key: "code",
    },
    {
      title: "金额",
      dataIndex: "amount",
      key: "amount",
    },
    {
      title: "操作",
      key: "action",
      render: (text, record) => (
        <Button danger onClick={() => handleApplicationDelete(record.id)}>
          删除
        </Button>
      ),
    },
  ];

  const [, setSearchText] = useState<React.Key>("");

  const handleSearch = (
    selectedKeys: FilterDropdownProps["selectedKeys"],
    confirm: FilterDropdownProps["confirm"]
  ) => {
    confirm();
    setSearchText(selectedKeys[0]);
  };

  const handleReset = (clearFilters: FilterDropdownProps["clearFilters"]) => {
    clearFilters?.();
    setSearchText("");
  };

  const [exportFormVisible, setExportFormVisible] = useState(false);
  const [exportScholarship, setExportScholarship] = useState("");
  const [exportClasses, setExportClasses] = useState<string[]>([]);
  const [exportLoading, setExportLoading] = useState(false);

  const handleApplicationExport = async (
    example?: GetScholarshipApplicationsForCounselors_scholarship_application[]
  ) => {
    if (!example && exportClasses.length === 0) {
      message.info("请选择筛选条件");
      return;
    }

    setExportLoading(true);

    const Xlsx = await import("xlsx");

    const applications = (example
      ? example
      : applicationsForCounselors!.scholarship_application.filter(
          (application) =>
            (exportScholarship
              ? application.scholarship === exportScholarship
              : true) &&
            (exportClasses.includes("全部")
              ? true
              : exportClasses.some((_class) =>
                  application.student.class?.includes(_class)
                ))
        )
    ).map((i) => [
      i.id,
      i.student.id,
      i.student.name,
      i.student.class,
      i.honor,
      i.scholarship,
      i.code,
      i.amount,
    ]);

    if (applications.length === 0) {
      message.info("未找到符合条件的奖学金");
      setExportLoading(false);
      return;
    }

    const head = [
      "申请 ID",
      "学号",
      "姓名",
      "班级",
      "荣誉",
      "奖学金",
      "代码",
      "金额",
    ];

    applications.unshift(head);

    const worksheet = Xlsx.utils.aoa_to_sheet(applications);
    const workbook = Xlsx.utils.book_new();
    Xlsx.utils.book_append_sheet(workbook, worksheet, "奖学金");
    Xlsx.writeFile(
      workbook,
      exportScholarship ? `奖学金-${exportScholarship}.xlsx` : `奖学金.xlsx`
    );

    if (!example) {
      message.success("奖学金导出成功");
    }
    setExportLoading(false);
  };

  const handleExampleDownload = () => {
    const student = {
      id: 2016000000,
      name: "测试学生",
      department: "电子系",
      class: "无60",
    };
    const example = [
      {
        id: "8ac0f001-8d9f-4de7-96c5-9fbfb638ad5f",
        student,
        honor: "好读书奖",
        code: "J3032030",
        scholarship: "好读书奖学金",
        amount: 3000,
      },
      {
        id: "8bc0f001-8d9f-4de7-96c5-9fbfb638ad5f",
        student,
        honor: "好读书奖",
        code: "J3032080",
        scholarship: "好读书奖学金",
        amount: 8000,
      },
      {
        id: "8cc0f001-8d9f-4de7-96c5-9fbfb638ad5f",
        student,
        honor: "学业优秀奖",
        code: "J2022050",
        scholarship: "清华之友——华为奖学金",
        amount: 5000,
      },
    ];
    handleApplicationExport(example as any);
  };

  const [importFormVisible, setImportFormVisible] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [fileList, setFileList] = useState<FileList | null>(null);
  const [parseProgress, setParseProgress] = useState(0);

  const client = useApolloClient();

  const handleApplicationImport = async () => {
    if (!fileList || fileList.length !== 1) {
      message.info("请选择文件");
      return;
    }
    const file = fileList[0];

    setImportLoading(true);

    const Xlsx = await import("xlsx");

    try {
      const reader = new FileReader();
      const data = await new Promise<ArrayBuffer>((resolve, reject) => {
        reader.onerror = () => {
          reader.abort();
          reject();
        };

        reader.onload = () => {
          resolve(reader.result as ArrayBuffer);
        };

        reader.readAsBinaryString(file);
      });
      const workbook = Xlsx.read(data, { type: "binary" });
      const firstWorksheet = workbook.Sheets[workbook.SheetNames[0]];

      const applications = (Xlsx.utils.sheet_to_json(firstWorksheet, {
        header: 1,
      }) as (string | number)[][]).filter((i) => i.length !== 0);
      const head = applications.shift();
      if (!head || head.length < 7) {
        throw new Error("Parse error");
      }

      applications.map((application) => {
        const code = application[6].toString().trim();
        const name = application[5].toString().trim();
        const honor = application[4].toString().trim();

        if (
          !scholarshipNames.includes(name) ||
          !honors.includes(honor as any)
        ) {
          throw new Error("Parse error");
        }
        const codes = [...scholarships[name as keyof typeof scholarships]].map(
          (i) => i.code
        );
        if (!codes.includes(code as any)) {
          throw new Error("Parse error");
        }

        return "";
      });

      let count = 0;
      await Promise.all(
        applications.map(async (application) => {
          try {
            const student_id = application[1].toString();
            const code = application[6].toString().trim();
            const scholarship = application[5].toString().trim();
            const amount = parseInt(application[7].toString().trim(), 10);
            const honor = application[4].toString().trim();

            const { errors } = await client.mutate<
              AddScholarshipApplication,
              AddScholarshipApplicationVariables
            >({
              mutation: ADD_SCHOLARSHIP_APPLICATION,
              variables: {
                student_id,
                scholarship,
                honor,
                amount,
                code,
              },
            });

            count++;
            setParseProgress(Math.round((count / applications.length) * 100));

            if (errors) {
              throw errors;
            }
          } catch (err) {
            throw err;
          }
        })
      );
      refetchApplicationsForCounselors();
    } catch (err) {
      message.error("文件解析失败：" + err);
    } finally {
      setImportLoading(false);
    }
  };

  const [thankLetterGenerating, setThankLetterGenerating] = useState(false);

  return (
    <Space
      direction="vertical"
      css={`
        width: 100%;
      `}
    >
      <Typography.Title level={2}>关键时间点</Typography.Title>
      <Timeline>
        <Timeline.Item color="green">
          <p>第一阶段：奖学金荣誉申请</p>
          <p>2019-09-22 00:00 ~ 2019-09-23 23:59</p>
        </Timeline.Item>
        <Timeline.Item color="green">
          <p>第二阶段：奖学金申请结果公示</p>
          <p>2019-10-08 00:00 ~ 2019-10-10 23:59</p>
        </Timeline.Item>
      </Timeline>
      <Typography.Title level={2}>奖学金</Typography.Title>
      {userData?.role !== "counselor" && (
        <>
          <List
            loading={applicationLoading}
            dataSource={applicationData?.scholarship_application}
            renderItem={(item) => {
              return (
                <Descriptions
                  key={item.id}
                  bordered
                  size="small"
                  css={`
                    margin: 24px auto;
                  `}
                >
                  <Descriptions.Item label="奖学金" span={1}>
                    {item.scholarship}
                  </Descriptions.Item>
                  <Descriptions.Item label="金额" span={1}>
                    {item.amount}
                  </Descriptions.Item>
                  <Descriptions.Item label="荣誉" span={1}>
                    {item.honor}
                  </Descriptions.Item>
                  <Descriptions.Item label="专用申请表" span={3}>
                    {item.form_url && isUrl(item.form_url) ? (
                      <a
                        href={item.form_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {item.form_url}
                      </a>
                    ) : (
                      item.form_url ?? "无"
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="感谢信正文" span={3}>
                    <Text
                      css={`
                        word-rap: break-word;
                        white-space: pre-wrap;
                      `}
                    >
                      {item.thank_letter ?? "无"}
                    </Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="操作" span={3}>
                    <Button
                      css={`
                        margin: 5px;
                      `}
                      onClick={() => {
                        setEditingApplication(item);
                        form.setFieldsValue(item);
                        setApplicationFormVisible(true);
                      }}
                    >
                      上传材料
                    </Button>
                    <Button
                      css={`
                        margin: 5px;
                      `}
                      loading={thankLetterGenerating}
                      disabled={!item.thank_letter}
                      onClick={() => {
                        setThankLetterGenerating(true);
                        try {
                          generateThankLetter(item);
                        } catch {
                          message.error("感谢信预览失败");
                        } finally {
                          setThankLetterGenerating(false);
                        }
                      }}
                    >
                      预览感谢信
                    </Button>
                  </Descriptions.Item>
                </Descriptions>
              );
            }}
          />
          <Modal
            visible={applicationFormVisible}
            title="编辑申请"
            centered
            destroyOnClose
            okText="提交"
            onCancel={() => {
              setApplicationFormVisible(false);
              setEditingApplication(undefined);
              form.resetFields();
            }}
            onOk={handleApplicationEdit}
            maskClosable={false}
            confirmLoading={applicationUpdating}
          >
            <Form
              form={form}
              name="application"
              onFinish={handleApplicationEdit}
              initialValues={editingApplication}
            >
              <Form.Item name="honor" label="荣誉">
                <Select disabled>{honorSelectOptions}</Select>
              </Form.Item>
              <Form.Item name="scholarship" label="奖学金">
                <Select disabled>{scholarshipSelectOptions}</Select>
              </Form.Item>
              <Form.Item name="code" label="代码">
                <Input disabled />
              </Form.Item>
              <Form.Item name="amount" label="金额">
                <Input disabled type="number" />
              </Form.Item>
              <Form.Item name="form_url" label="专用申请表">
                <Input placeholder="使用清华云盘上传文件并在此粘贴下载链接（带有 ?dl=1 后缀）" />
              </Form.Item>
              <Form.Item name="thank_letter" label="感谢信正文">
                <TextArea
                  css={`
                    resize: none;
                  `}
                  autoSize={{ minRows: 5 }}
                  placeholder="仅需输入感谢信正文，抬头和称呼等内容以及格式由系统预览自动生成。预览结果不包含姓名，需自行打印手写签字。"
                />
              </Form.Item>
            </Form>
          </Modal>
        </>
      )}
      {userData?.role === "counselor" && (
        <>
          <Space direction="horizontal">
            <Button
              disabled={applicationsForCounselorsLoading}
              onClick={() => setExportFormVisible(true)}
            >
              导出奖学金
            </Button>
            <Button
              disabled={applicationsForCounselorsLoading}
              onClick={handleExampleDownload}
            >
              下载导入样例
            </Button>
            <Button
              disabled={applicationsForCounselorsLoading}
              onClick={() => setImportFormVisible(true)}
            >
              导入奖学金
            </Button>
            <div style={{ flex: 1 }} />
            <Button
              disabled={applicationsForCounselorsLoading}
              onClick={() => setApplicationFormVisible(true)}
            >
              添加奖学金记录
            </Button>
          </Space>
          <Table
            loading={applicationsForCounselorsLoading}
            dataSource={applicationsForCounselors?.scholarship_application}
            columns={scholarshipColumnsForCounselor}
            rowKey="id"
            expandedRowRender={(record) => (
              <Descriptions key={record.id} size="small">
                <Descriptions.Item label="专用申请表" span={3}>
                  {record.form_url && isUrl(record.form_url) ? (
                    <a
                      href={record.form_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {record.form_url}
                    </a>
                  ) : (
                    record.form_url ?? "无"
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="感谢信正文" span={3}>
                  <Text
                    css={`
                      word-rap: break-word;
                      white-space: pre-wrap;
                    `}
                  >
                    {record.thank_letter ?? "无"}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="操作" span={3}>
                  <Button
                    loading={thankLetterGenerating}
                    disabled={!record.thank_letter}
                    onClick={() => {
                      setThankLetterGenerating(true);
                      try {
                        generateThankLetter(record);
                      } catch {
                        message.error("感谢信预览失败");
                      } finally {
                        setThankLetterGenerating(false);
                      }
                    }}
                  >
                    预览感谢信
                  </Button>
                </Descriptions.Item>
              </Descriptions>
            )}
          />
          <Modal
            visible={exportFormVisible}
            title="导出奖学金"
            centered
            onOk={() => handleApplicationExport()}
            onCancel={() => setExportFormVisible(false)}
            maskClosable={false}
            confirmLoading={exportLoading}
          >
            <Form layout="vertical">
              <Form.Item required label="奖学金">
                <Select<string>
                  placeholder="奖学金名称"
                  onChange={(value) => setExportScholarship(value)}
                  defaultValue=""
                >
                  {scholarshipSelectOptions}
                </Select>
              </Form.Item>
              <Form.Item required label="班级">
                <Select<string[]>
                  mode="tags"
                  placeholder="选择需要导出的班级（可多选）"
                  onChange={(value) => setExportClasses(value)}
                >
                  {exportSelectOptions}
                </Select>
              </Form.Item>
              <Typography.Text>
                若班级不在下拉菜单内，请手动输入班级名，并回车，结果即会包含该班级的奖学金记录。
              </Typography.Text>
            </Form>
          </Modal>
          <Modal
            visible={importFormVisible}
            title="导入奖学金"
            centered
            onOk={handleApplicationImport}
            onCancel={() => setImportFormVisible(false)}
            maskClosable={false}
            confirmLoading={importLoading}
            okText="导入"
          >
            <Typography.Paragraph>
              上传 Excel 文件以添加奖学金。Excel
              的格式应与样例文件相同，奖学金的名称、代码及金额均应正确。
            </Typography.Paragraph>
            <div
              css={`
                display: flex;
                flex-direction: row;
                align-items: center;
                justify-content: space-between;
              `}
            >
              <input
                id="upload-file"
                accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                type="file"
                name="file"
                onChange={(e) => setFileList(e.target.files)}
              />
              <label htmlFor="upload-file"></label>
              {parseProgress > 0 && (
                <Progress
                  type="circle"
                  percent={parseProgress}
                  status="active"
                />
              )}
            </div>
          </Modal>
        </>
      )}
    </Space>
  );
};

export default ScholarshipApplicationPage;
